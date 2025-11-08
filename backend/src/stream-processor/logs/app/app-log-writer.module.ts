import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../../../shared/logs/logs.module";
import { AppLogRepository } from "../../../shared/logs/app/app-log.repository";
import { AppLogWriterService } from "./app-log-writer.service";

@Module({
  imports: [LogInfrastructureModule],
  providers: [AppLogWriterService, AppLogRepository],
  exports: [AppLogWriterService],
})
export class AppLogWriterModule {}
