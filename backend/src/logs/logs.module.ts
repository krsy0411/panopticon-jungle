import { Module } from "@nestjs/common";
import { LogController } from "./logs.controller";
import { LogStorageService } from "./log-storage.service";
import { LogRepository } from "./logs.repository";
import { LogService } from "./logs.service";

@Module({
  controllers: [LogController],
  providers: [LogService, LogRepository, LogStorageService],
  exports: [LogService, LogStorageService],
})
export class LogModule {}
