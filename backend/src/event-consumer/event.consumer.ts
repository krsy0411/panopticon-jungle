import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import { LogService } from "../logs/logs.service";
import { MetricsAggregatorService } from "../metrics/services/metrics-aggregator.service";
import type { CreateLogDto } from "../logs/dto/create-logs.dto";
import type { CreateApiMetricDto } from "../metrics/api/dto/create-api-metric.dto";
import type { CreateSystemMetricDto } from "../metrics/system/dto/create-system-metric.dto";

/**
 * 통합 이벤트 컨슈머
 * Kafka의 로그와 메트릭 토픽을 처리합니다
 */
@Controller()
export class EventConsumer {
  private readonly logger = new Logger(EventConsumer.name);

  constructor(
    private readonly logService: LogService,
    private readonly metricsAggregator: MetricsAggregatorService,
  ) {}

  /**
   * 로그 이벤트 처리
   */
  @EventPattern(process.env.KAFKA_LOG_TOPIC ?? "logs")
  async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload, skip");
      return;
    }

    try {
      const log = this.toLogDto(value);
      await this.logService.ingest(log, {
        remoteAddress: null,
        userAgent: null,
      });
      this.logger.log(
        `Log ingested (topic=${context.getTopic()}, partition=${context.getPartition()})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process log event",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * API 메트릭 이벤트 처리
   */
  @EventPattern(process.env.KAFKA_API_METRICS_TOPIC ?? "metrics.api")
  async handleApiMetricEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload for API metric, skip");
      return;
    }

    try {
      const metric = this.toApiMetricDto(value);
      await this.metricsAggregator.saveApiMetric(metric);
      this.logger.log(
        `API metric saved (topic=${context.getTopic()}, partition=${context.getPartition()})`,
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
   */
  @EventPattern(process.env.KAFKA_SYSTEM_METRICS_TOPIC ?? "metrics.system")
  async handleSystemMetricEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload for system metric, skip");
      return;
    }

    try {
      const metric = this.toSystemMetricDto(value);
      await this.metricsAggregator.saveSystemMetric(metric);
      this.logger.log(
        `System metric saved (topic=${context.getTopic()}, partition=${context.getPartition()})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process system metric event",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Kafka payload를 LogDto로 변환
   */
  private toLogDto(payload: unknown): CreateLogDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateLogDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateLogDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateLogDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateLogDto;
    }

    throw new Error("Unsupported Kafka payload type for log");
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
