import { Module } from "@nestjs/common";
import { MetricsCoreModule } from "../../shared/metrics/metrics-core.module";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "../../shared/metrics/services/metrics.service";

@Module({
  imports: [MetricsCoreModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsQueryModule {}
