import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../shared/apm/apm.module";
import { ServiceMetricsController } from "./service-metrics.controller";
import { ServiceMetricsService } from "./service-metrics.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [ServiceMetricsController],
  providers: [ServiceMetricsService],
})
export class ServiceMetricsModule {}
