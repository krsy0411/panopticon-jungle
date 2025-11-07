import { Module } from "@nestjs/common";
import { QueryApiController } from "./query-api.controller";
import { AppLogQueryModule } from "./logs/app/app-log.module";
import { HttpLogQueryModule } from "./logs/http/http-log.module";
import { MetricsQueryModule } from "./metrics/metrics.module";

@Module({
  imports: [AppLogQueryModule, HttpLogQueryModule, MetricsQueryModule],
  controllers: [QueryApiController],
})
export class QueryApiModule {}
