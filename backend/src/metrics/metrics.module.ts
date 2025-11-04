import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./services/metrics.service";
import { MetricsAggregatorService } from "./services/metrics-aggregator.service";
import { HttpLogAggregatorService } from "./services/http-log-aggregator.service";
import { SystemMetricsRepository } from "./system/system-metrics.repository";
import { HttpMetricsRepository } from "./http/http-metrics.repository";

/**
 * 메트릭 모듈
 * 시스템 메트릭 및 HTTP 로그 집계 관리
 */
@Module({
  controllers: [MetricsController],
  providers: [
    // Repositories
    SystemMetricsRepository,
    HttpMetricsRepository,
    // Services
    MetricsService,
    MetricsAggregatorService,
    HttpLogAggregatorService,
  ],
  exports: [MetricsService, MetricsAggregatorService, HttpLogAggregatorService],
})
export class MetricsModule {}
