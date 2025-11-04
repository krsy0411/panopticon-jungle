import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import { MetricsAggregatorService } from "../metrics/services/metrics-aggregator.service";
import type { CreateApiMetricDto } from "../metrics/api/dto/create-api-metric.dto";
import type { CreateSystemMetricDto } from "../metrics/system/dto/create-system-metric.dto";

/**
 * 메트릭 전용 컨슈머
 * API 메트릭과 시스템 메트릭만 처리하며,
 * 실시간 집계와 Redis 저장을 담당합니다
 */
@Controller()
export class MetricsConsumer {
  private readonly logger = new Logger(MetricsConsumer.name);

  constructor(private readonly metricsAggregator: MetricsAggregatorService) {}

  /**
   * API 메트릭 이벤트 처리
   * - Latency, Error Rate, Traffic (TPS) 추적
   * - 실시간 Redis 집계 (1분 윈도우)
   * - SLO 체크 및 알림
   */
  @EventPattern(process.env.KAFKA_API_METRICS_TOPIC ?? "metrics.api")
  async handleApiMetricEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload for API metric, skip");
      return;
    }

    const startTime = Date.now();

    try {
      const metric = this.toApiMetricDto(value);

      // 실시간 메트릭 로깅
      this.logger.log(
        `[API METRIC] service=${metric.service} endpoint=${metric.endpoint} ` +
          `method=${metric.method} latency=${metric.latencyMs}ms ` +
          `status=${metric.statusCode} timestamp=${new Date(metric.time || Date.now()).toISOString()}`,
      );

      // 실시간 집계 및 저장 (Redis + TimescaleDB)
      await this.metricsAggregator.saveApiMetric(metric);

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `API metric processed in ${processingTime}ms ` +
          `(topic=${context.getTopic()}, partition=${context.getPartition()}, offset=${context.getMessage().offset})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process API metric event",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 시스템 메트릭 이벤트 처리
   * - CPU, Memory, Disk, Network 추적
   * - Pod/Container 레벨 모니터링
   * - Saturation 실시간 감지
   */
  @EventPattern(process.env.KAFKA_SYSTEM_METRICS_TOPIC ?? "metrics.system")
  async handleSystemMetricEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload for system metric, skip");
      return;
    }

    const startTime = Date.now();

    try {
      const metric = this.toSystemMetricDto(value);

      // 실시간 메트릭 로깅
      this.logger.log(
        `[SYSTEM METRIC] service=${metric.service} pod=${metric.podName} ` +
          `CPU=${metric.cpuUsagePercent?.toFixed(2)}% Memory=${(metric.memoryUsageBytes ? metric.memoryUsageBytes / (1024 * 1024) : 0).toFixed(2)}Mi ` +
          `Disk=${metric.diskUsagePercent?.toFixed(2)}% NetworkIn=${(metric.networkRxBytes ? metric.networkRxBytes / 1024 : 0).toFixed(2)}KB/s NetworkOut=${(metric.networkTxBytes ? metric.networkTxBytes / 1024 : 0).toFixed(2)}KB/s ` +
          `timestamp=${new Date(metric.time || Date.now()).toISOString()}`,
      );

      // 실시간 집계 및 저장 (Redis + TimescaleDB)
      await this.metricsAggregator.saveSystemMetric(metric);

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `System metric processed in ${processingTime}ms ` +
          `(topic=${context.getTopic()}, partition=${context.getPartition()}, offset=${context.getMessage().offset})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process system metric event",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Kafka payload를 ApiMetricDto로 변환
   */
  private toApiMetricDto(payload: unknown): CreateApiMetricDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateApiMetricDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateApiMetricDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateApiMetricDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateApiMetricDto;
    }

    throw new Error("Unsupported Kafka payload type for API metric");
  }

  /**
   * Kafka payload를 SystemMetricDto로 변환
   */
  private toSystemMetricDto(payload: unknown): CreateSystemMetricDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateSystemMetricDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateSystemMetricDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateSystemMetricDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateSystemMetricDto;
    }

    throw new Error("Unsupported Kafka payload type for system metric");
  }

  /**
   * Kafka 메시지 래퍼 제거
   */
  private unwrapValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
}
