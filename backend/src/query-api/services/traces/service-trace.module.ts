import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { ServiceTraceController } from "./service-trace.controller";
import { ServiceTraceService } from "./service-trace.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [ServiceTraceController],
  providers: [ServiceTraceService],
})
export class ServiceTraceModule {}
