import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Consumer, Kafka, logLevel } from "kafkajs";

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

  constructor() {
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
      `Kafka consumer subscribed: topic=${this.topic}, groupId=${this.groupId}`
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
            const parsed: unknown = JSON.parse(rawValue);
            this.logger.log(
              `Consumed log (topic=${topic}, partition=${partition}): ${JSON.stringify(parsed)}`
            );
          } catch (error) {
            if (error instanceof Error) {
              this.logger.error(
                `Failed to parse Kafka message: ${rawValue}`,
                error.stack
              );
            } else {
              this.logger.error(
                `Failed to parse Kafka message: ${rawValue}; reason=${String(
                  error
                )}`
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

  async onModuleDestroy(): Promise<void> {
    if (!this.enabled || !this.consumer) {
      return;
    }

    await this.consumer.stop();
    await this.consumer.disconnect();
    this.logger.log("Kafka consumer stopped");
  }
}
