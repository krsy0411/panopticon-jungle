import { Global, Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../logs/logs.module";
import { ApmLogRepository } from "./logs/log.repository";
import { SpanRepository } from "./spans/span.repository";
import { RollupMetricsReadRepository } from "./rollup/rollup-metrics-read.repository";

@Global()
@Module({
  imports: [LogInfrastructureModule],
  providers: [ApmLogRepository, SpanRepository, RollupMetricsReadRepository],
  exports: [ApmLogRepository, SpanRepository, RollupMetricsReadRepository],
})
export class ApmInfrastructureModule {}
