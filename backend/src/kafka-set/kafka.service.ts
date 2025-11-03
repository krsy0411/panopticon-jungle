/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Consumer, Kafka, logLevel } from "kafkajs";
import { LogService } from "../logs/logs.service";
import { MetricsAggregatorService } from "../metrics/metrics-aggregator.service";
import type { CreateLogDto } from "../logs/dto/create-logs.dto";

const DEFAULT_CLIENT_ID = "panopticon-backend";
const DEFAULT_BROKERS = ["localhost:9092"];
const DEFAULT_LOG_TOPIC = "logs.raw";
const DEFAULT_CONSUMER_GROUP = "panopticon-backend-consumer";

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka: Kafka;
  private readonly topic: string;
  private readonly groupId: string;
  private readonly enabled: boolean;
  private consumer: Consumer | null = null;

  constructor(
    private readonly logService: LogService,
    private readonly metricsAggregator: MetricsAggregatorService,
  ) {
    //kafka 클라이언트 준비
    const brokersEnv = process.env.KAFKA_BROKERS;
    const brokers = brokersEnv
      ? brokersEnv
          .split(",")
          .map((broker) => broker.trim())
          .filter(Boolean)
      : DEFAULT_BROKERS;

    if (brokers.length === 0) {
      throw new Error("Kafka configuration error: no brokers provided");
    }

    const clientId = process.env.KAFKA_CLIENT_ID ?? DEFAULT_CLIENT_ID;

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.NOTHING,
      ssl: process.env.KAFKA_SSL === "true",
    });

    this.topic = process.env.KAFKA_LOG_TOPIC ?? DEFAULT_LOG_TOPIC;
    this.groupId = process.env.KAFKA_CONSUMER_GROUP ?? DEFAULT_CONSUMER_GROUP;
    this.enabled = process.env.NODE_ENV !== "test";
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log("Kafka consumer disabled in test environment");
      return;
    }

    // 토픽 자동 생성
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const created = await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic: this.topic,
            numPartitions: Number(process.env.KAFKA_TOPIC_PARTITIONS ?? 1),
            replicationFactor: Number(process.env.KAFKA_TOPIC_REPLICATION ?? 1),
          },
        ],
      });
      if (created) {
        this.logger.log(`Kafka topic ensured: ${this.topic}`);
      }
    } catch (error) {
      this.logger.debug(
        `Kafka topic creation skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await admin.disconnect();
    } // nestjs 서버 정상 구동 위함. 나중에 삭제

    //컨슈머 인스턴스 생성
    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      allowAutoTopicCreation:
        process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false",
    });
    //브로커에 연결
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.topic,
      fromBeginning: false,
    });

    this.logger.log(
      `Kafka consumer subscribed: topic=${this.topic}, groupId=${this.groupId}`,
    );

    void this.consumer
      .run({
        eachMessage: async ({ message, partition, topic }) => {
          const rawValue = message.value?.toString();

          if (!rawValue) {
            this.logger.warn("Received Kafka message without payload");
            return;
          }

          try {
            const parsed = JSON.parse(rawValue) as CreateLogDto;
            if (parsed && typeof parsed === "object") {
              // 1. 로그 저장
              await this.logService.ingest(parsed, {
                remoteAddress: null,
                userAgent: null,
              });

              // 2. 메트릭 추출 및 저장 (논블로킹)
              this.extractAndSaveMetric(parsed);

              this.logger.debug(
                `Kafka log stored (topic=${topic}, partition=${partition})`,
              );
            } else {
              this.logger.warn(
                `Kafka message is not an object, skip storing: ${rawValue}`,
              );
            }
          } catch (error) {
            if (error instanceof Error) {
              this.logger.error(
                `Failed to process Kafka message: ${rawValue}`,
                error.stack,
              );
            } else {
              this.logger.error(
                `Failed to process Kafka message: ${rawValue}; reason=${String(
                  error,
                )}`,
              );
            }
          }
        },
      })
      .catch((error) => {
        if (error instanceof Error) {
          this.logger.error("Kafka consumer run failed", error.stack);
        } else {
          this.logger.error(`Kafka consumer run failed: ${String(error)}`);
        }
      });
  }

  /**
   * 로그에서 메트릭 추출 및 저장 (논블로킹)
   * API 메트릭과 시스템 메트릭을 구분하여 처리
   */
  private extractAndSaveMetric(log: CreateLogDto): void {
    const logData = log as any;

    // 1. API 메트릭 추출 (latency, status, endpoint)
    if (logData.latency || logData.status || logData.endpoint) {
      const apiMetric = {
        service: log.service,
        endpoint: logData.endpoint || undefined,
        method: logData.method || undefined,
        latency: logData.latency ? parseFloat(logData.latency) : undefined,
        status: logData.status ? parseInt(logData.status) : undefined,
        timestamp: log.timestamp
          ? new Date(log.timestamp).getTime()
          : Date.now(),
      };

      // API 메트릭 저장 (논블로킹)
      this.metricsAggregator.addApiMetric(apiMetric).catch((err) => {
        this.logger.error(
          `Failed to save API metric for ${log.service}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    // 2. 시스템 메트릭 추출 (CPU, 메모리 등)
    if (
      logData.cpuUsagePercent !== undefined ||
      logData.cpu_usage_percent !== undefined ||
      logData.memoryUsagePercent !== undefined ||
      logData.memory_usage_percent !== undefined
    ) {
      const systemMetric = {
        service: log.service,
        timestamp: log.timestamp
          ? new Date(log.timestamp).getTime()
          : Date.now(),
        podName: logData.podName || logData.pod_name || undefined,
        nodeName: logData.nodeName || logData.node_name || undefined,
        namespace: logData.namespace || undefined,

        // CPU (camelCase와 snake_case 모두 지원)
        cpuUsagePercent:
          logData.cpuUsagePercent ?? logData.cpu_usage_percent ?? undefined,
        cpuCoresUsed:
          logData.cpuCoresUsed ?? logData.cpu_cores_used ?? undefined,

        // 메모리
        memoryUsageBytes:
          logData.memoryUsageBytes ?? logData.memory_usage_bytes ?? undefined,
        memoryUsagePercent:
          logData.memoryUsagePercent ??
          logData.memory_usage_percent ??
          undefined,
        memoryLimitBytes:
          logData.memoryLimitBytes ?? logData.memory_limit_bytes ?? undefined,

        // 디스크
        diskUsagePercent:
          logData.diskUsagePercent ?? logData.disk_usage_percent ?? undefined,
        diskUsageBytes:
          logData.diskUsageBytes ?? logData.disk_usage_bytes ?? undefined,
        diskIoReadBytes:
          logData.diskIoReadBytes ?? logData.disk_io_read_bytes ?? undefined,
        diskIoWriteBytes:
          logData.diskIoWriteBytes ?? logData.disk_io_write_bytes ?? undefined,

        // 네트워크
        networkRxBytes:
          logData.networkRxBytes ?? logData.network_rx_bytes ?? undefined,
        networkTxBytes:
          logData.networkTxBytes ?? logData.network_tx_bytes ?? undefined,
        networkRxPackets:
          logData.networkRxPackets ?? logData.network_rx_packets ?? undefined,
        networkTxPackets:
          logData.networkTxPackets ?? logData.network_tx_packets ?? undefined,

        // 메타데이터
        metadata: logData.metadata || undefined,
      };

      // 시스템 메트릭 저장 (논블로킹)
      this.metricsAggregator.addSystemMetric(systemMetric).catch((err) => {
        this.logger.error(
          `Failed to save system metric for ${log.service}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.enabled || !this.consumer) {
      return;
    }

    await this.consumer.stop();
    await this.consumer.disconnect();
    this.logger.log("Kafka consumer stopped");
  }
}
