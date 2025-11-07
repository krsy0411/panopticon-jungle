import { Module } from "@nestjs/common";
import { MetricsCoreModule } from "../../shared/metrics/metrics-core.module";
import { MetricsAggregatorService } from "./services/metrics-aggregator.service";
import { HttpLogAggregatorService } from "./services/http-log-aggregator.service";

@Module({
  imports: [MetricsCoreModule],
  providers: [MetricsAggregatorService, HttpLogAggregatorService],
  exports: [MetricsAggregatorService, HttpLogAggregatorService],
})
export class MetricsWriterModule {}
