import { Injectable, Logger } from "@nestjs/common";
import { HttpMetricData } from "./interfaces/http-metric.interface";
import { SystemMetricData } from "./interfaces/system-metric.interface";
import { ApiMetricsRepository } from "./api-metrics.repository";
import { SystemMetricsRepository } from "./system-metrics.repository";

/**
 * 통합 메트릭 집계 서비스
 * Kafka에서 수신한 API 메트릭과 시스템 메트릭을 TimescaleDB에 저장
 */
@Injectable()
export class MetricsAggregatorService {
  private readonly logger = new Logger(MetricsAggregatorService.name);

  constructor(
    private readonly apiMetricsRepo: ApiMetricsRepository,
    private readonly systemMetricsRepo: SystemMetricsRepository,
  ) {}

  /**
   * API 메트릭 저장 - Kafka Consumer에서 호출
   */
  async addApiMetric(metric: HttpMetricData): Promise<void> {
    try {
      await this.apiMetricsRepo.save(metric);
      this.logger.debug(
        `API metric saved: ${metric.service} - ${metric.endpoint || "N/A"}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save API metric: ${metric.service}`,
        error instanceof Error ? error.stack : String(error),
      );
      // 에러를 throw하지 않음 - Kafka Consumer가 멈추지 않도록
    }
  }

  /**
   * 시스템 메트릭 저장 - Kafka Consumer에서 호출
   */
  async addSystemMetric(metric: SystemMetricData): Promise<void> {
    try {
      await this.systemMetricsRepo.save(metric);
      this.logger.debug(
        `System metric saved: ${metric.service} (pod: ${metric.podName || "N/A"})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save system metric: ${metric.service}`,
        error instanceof Error ? error.stack : String(error),
      );
      // 에러를 throw하지 않음
    }
  }

  /**
   * API 메트릭 배치 저장
   */
  async addApiMetricsBatch(metrics: HttpMetricData[]): Promise<void> {
    try {
      await this.apiMetricsRepo.saveBatch(metrics);
      this.logger.debug(`API metrics batch saved: ${metrics.length} items`);
    } catch (error) {
      this.logger.error(
        `Failed to save API metrics batch`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 시스템 메트릭 배치 저장
   */
  async addSystemMetricsBatch(metrics: SystemMetricData[]): Promise<void> {
    try {
      await this.systemMetricsRepo.saveBatch(metrics);
      this.logger.debug(`System metrics batch saved: ${metrics.length} items`);
    } catch (error) {
      this.logger.error(
        `Failed to save system metrics batch`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
