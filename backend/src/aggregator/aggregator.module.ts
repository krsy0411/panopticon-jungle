import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../shared/logs/logs.module";
import { RollupConfigService } from "./rollup-config.service";
import { RollupCheckpointService } from "./rollup-checkpoint.service";
import { MinuteWindowPlanner } from "./window-planner.service";
import { SpanMinuteAggregationService } from "./span-minute-aggregation.service";
import { RollupMetricsRepository } from "./rollup-metrics.repository";
import { AggregatorRunner } from "./aggregator-runner.service";

/**
 * Aggregator 애플리케이션 루트 모듈
 */
@Module({
  imports: [LogInfrastructureModule],
  providers: [
    RollupConfigService,
    RollupCheckpointService,
    MinuteWindowPlanner,
    SpanMinuteAggregationService,
    RollupMetricsRepository,
    AggregatorRunner,
  ],
})
export class AggregatorModule {}
