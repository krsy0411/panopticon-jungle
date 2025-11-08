import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../../../shared/logs/logs.module";
import { AppLogController } from "./app-log.controller";
import { AppLogQueryService } from "./app-log.service";
import { AppLogRepository } from "../../../shared/logs/app/app-log.repository";

@Module({
  imports: [LogInfrastructureModule],
  controllers: [AppLogController],
  providers: [AppLogQueryService, AppLogRepository],
  exports: [AppLogQueryService],
})
export class AppLogQueryModule {}
