import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import { MetricsAggregatorService } from "../metrics/services/metrics-aggregator.service";
import { HttpLogAggregatorService } from "../metrics/services/http-log-aggregator.service";
import type { CreateSystemMetricDto } from "../../shared/metrics/system/dto/create-system-metric.dto";
import type { CreateHttpLogDto } from "../../shared/logs/dto/create-http-log.dto";

/**
 * 메트릭 전용 컨슈머
 * API 메트릭, 시스템 메트릭, HTTP 로그를 처리하며,
 * 실시간 집계를 담당합니다
 */
@Controller()
export class MetricsConsumer {
  private readonly logger = new Logger(MetricsConsumer.name);

  constructor(
    private readonly metricsAggregator: MetricsAggregatorService,
    private readonly httpLogAggregator: HttpLogAggregatorService,
  ) {}

  /**
   * 시스템 메트릭 이벤트 처리
   * - CPU, Memory, Disk, Network 추적
   * - Pod/Container 레벨 모니터링
   * - Saturation 실시간 감지
   */
  @EventPattern(process.env.KAFKA_SYSTEM_METRICS_TOPIC ?? "logs.metric")
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
          `timestamp=${new Date(metric.timestamp || Date.now()).toISOString()}`,
      );

      // 실시간 집계 및 저장 (TimescaleDB)
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
   * HTTP 로그 이벤트 처리
   * - 요청 수와 에러율 집계
   * - TimescaleDB에 실시간 저장
   */
  @EventPattern(process.env.KAFKA_HTTP_LOG_TOPIC ?? "logs.http")
  async handleHttpLogEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload for HTTP log, skip");
      return;
    }

    const startTime = Date.now();

    try {
      const log = this.toHttpLogDto(value);

      // 서비스명 추출 (upstream_service 또는 path에서 추출)
      const service =
        log.upstream_service || this.extractServiceFromPath(log.path);

      // 타임스탬프 파싱
      const timestamp = log.timestamp
        ? new Date(log.timestamp).getTime()
        : Date.now();

      // HTTP 로그 집계 (TimescaleDB 실시간 저장)
      await this.httpLogAggregator.addLog(
        service || "unknown",
        log.status_code || 200,
        timestamp,
      );

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `HTTP log saved: ${service} status=${log.status_code} ` +
          `(topic=${context.getTopic()}, partition=${context.getPartition()}, ` +
          `offset=${context.getMessage().offset}, processed in ${processingTime}ms)`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process HTTP log event",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Kafka payload를 HttpLogDto로 변환
   */
  private toHttpLogDto(payload: unknown): CreateHttpLogDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateHttpLogDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateHttpLogDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateHttpLogDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateHttpLogDto;
    }

    throw new Error("Unsupported Kafka payload type for HTTP log");
  }

  /**
   * URL path에서 서비스명 추출
   * 예: /api/users/123 -> api
   */
  private extractServiceFromPath(path?: string | null): string | null {
    if (!path) return null;
    const match = path.match(/^\/([^/]+)/);
    return match ? match[1] : null;
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
