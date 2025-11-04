import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../logs.module";
import { AppLogController } from "./app-log.controller";
import { AppLogService } from "./app-log.service";
import { AppLogRepository } from "./app-log.repository";

@Module({
  imports: [LogInfrastructureModule],
  controllers: [AppLogController],
  providers: [AppLogService, AppLogRepository],
  exports: [AppLogService, AppLogRepository],
})
export class AppLogModule {}
