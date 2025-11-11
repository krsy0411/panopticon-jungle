import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../shared/apm/apm.module";
import { TraceController } from "./trace.controller";
import { TraceQueryService } from "./trace.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [TraceController],
  providers: [TraceQueryService],
})
export class TraceQueryModule {}
