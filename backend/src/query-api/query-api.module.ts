import { Module } from "@nestjs/common";
import { QueryApiController } from "./query-api.controller";
import { TraceQueryModule } from "./traces/trace.module";
import { ServiceMetricsModule } from "./service-metrics/service-metrics.module";
import { ServiceOverviewModule } from "./services/overview/service-overview.module";
import { EndpointMetricsModule } from "./services/endpoints/endpoint-metrics.module";
import { ServiceTraceModule } from "./services/traces/service-trace.module";
import { LogsModule } from "./logs/logs.module";
import { SpansModule } from "./spans/spans.module";

@Module({
  imports: [
    TraceQueryModule,
    ServiceMetricsModule,
    ServiceOverviewModule,
    EndpointMetricsModule,
    ServiceTraceModule,
    LogsModule,
    SpansModule,
  ],
  controllers: [QueryApiController],
})
export class QueryApiModule {}
