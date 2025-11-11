import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { EndpointMetricsController } from "./endpoint-metrics.controller";
import { EndpointMetricsService } from "./endpoint-metrics.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [EndpointMetricsController],
  providers: [EndpointMetricsService],
})
export class EndpointMetricsModule {}
