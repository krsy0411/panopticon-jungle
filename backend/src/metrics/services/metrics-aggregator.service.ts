import { Injectable, Logger } from "@nestjs/common";
import { CreateSystemMetricDto } from "../system/dto/create-system-metric.dto";
import { SystemMetricsRepository } from "../system/system-metrics.repository";

/**
 * 메트릭 집계 서비스
 * Kafka Consumer에서 메트릭 데이터를 수신하여 저장 처리
 */
@Injectable()
export class MetricsAggregatorService {
  private readonly logger = new Logger(MetricsAggregatorService.name);

  constructor(private readonly systemMetricsRepo: SystemMetricsRepository) {}

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
