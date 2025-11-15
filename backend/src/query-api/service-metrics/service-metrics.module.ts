import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../shared/apm/apm.module";
import { ServiceMetricsController } from "./service-metrics.controller";
import { ServiceMetricsService } from "./service-metrics.service";
import { MetricsQueryNormalizerService } from "./metrics-query-normalizer.service";
import { MetricsCacheService } from "./metrics-cache.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [ServiceMetricsController],
  providers: [
    ServiceMetricsService,
    MetricsQueryNormalizerService,
    MetricsCacheService,
  ],
})
export class ServiceMetricsModule {}
