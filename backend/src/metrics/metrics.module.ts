import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MetricsAggregatorService } from "./metrics-aggregator.service";
import { ApiMetricsRepository } from "./api-metrics.repository";
import { SystemMetricsRepository } from "./system-metrics.repository";

/**
 * 통합 메트릭 모듈
 * API 메트릭과 시스템 메트릭 관리
 */
@Module({
  controllers: [MetricsController],
  providers: [
    // Repositories
    ApiMetricsRepository,
    SystemMetricsRepository,
    // Services
    MetricsService,
    MetricsAggregatorService,
  ],
  exports: [MetricsService, MetricsAggregatorService],
})
export class MetricsModule {}
