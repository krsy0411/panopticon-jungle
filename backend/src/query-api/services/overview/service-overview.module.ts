import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { ServiceOverviewController } from "./service-overview.controller";
import { ServiceOverviewService } from "./service-overview.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [ServiceOverviewController],
  providers: [ServiceOverviewService],
})
export class ServiceOverviewModule {}
