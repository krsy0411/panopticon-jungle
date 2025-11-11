import { Module } from "@nestjs/common";
import { QueryApiController } from "./query-api.controller";
import { TraceQueryModule } from "./traces/trace.module";
import { ServiceMetricsModule } from "./service-metrics/service-metrics.module";

@Module({
  imports: [TraceQueryModule, ServiceMetricsModule],
  controllers: [QueryApiController],
})
export class QueryApiModule {}
