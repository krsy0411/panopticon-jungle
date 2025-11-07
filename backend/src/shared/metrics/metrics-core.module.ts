import { Global, Module } from "@nestjs/common";
import { SystemMetricsRepository } from "./system/system-metrics.repository";
import { HttpMetricsRepository } from "./http/http-metrics.repository";
import { TimescaleConnectionService } from "./common/timescale-connection.service";
import { TimescaleSchemaService } from "./common/timescale-schema.service";

@Global()
@Module({
  providers: [
    TimescaleConnectionService,
    TimescaleSchemaService,
    SystemMetricsRepository,
    HttpMetricsRepository,
  ],
  exports: [
    TimescaleSchemaService,
    TimescaleConnectionService,
    SystemMetricsRepository,
    HttpMetricsRepository,
  ],
})
export class MetricsCoreModule {}
