import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../shared/apm/apm.module";
import { LogsController } from "./logs.controller";
import { LogSearchService } from "./logs.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [LogsController],
  providers: [LogSearchService],
})
export class LogsModule {}
