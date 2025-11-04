import { Injectable, Logger } from "@nestjs/common";
import { CreateApiMetricDto } from "../api/dto/create-api-metric.dto";
import { CreateSystemMetricDto } from "../system/dto/create-system-metric.dto";
import { ApiMetricsRepository } from "../api/api-metrics.repository";
import { SystemMetricsRepository } from "../system/system-metrics.repository";

/**
 * 메트릭 집계 서비스
 * Kafka Consumer에서 메트릭 데이터를 수신하여 저장 처리
 */
@Injectable()
export class MetricsAggregatorService {
  private readonly logger = new Logger(MetricsAggregatorService.name);

  constructor(
    private readonly apiMetricsRepo: ApiMetricsRepository,
    private readonly systemMetricsRepo: SystemMetricsRepository,
  ) {}

  /**
   * API 메트릭 저장
   */
  async saveApiMetric(createMetricDto: CreateApiMetricDto): Promise<void> {
    try {
      await this.apiMetricsRepo.save(createMetricDto);
      this.logger.debug(
        `API metric saved: ${createMetricDto.service} - ${createMetricDto.endpoint}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save API metric: ${createMetricDto.service}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 시스템 메트릭 저장
   */
  async saveSystemMetric(
    createMetricDto: CreateSystemMetricDto,
  ): Promise<void> {
    try {
      await this.systemMetricsRepo.save(createMetricDto);
      this.logger.debug(
        `System metric saved: ${createMetricDto.service} (pod: ${createMetricDto.podName})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save system metric: ${createMetricDto.service}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
