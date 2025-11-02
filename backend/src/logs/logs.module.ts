import { Module } from "@nestjs/common";
import { LogController } from "./logs.controller";
import { LogRepository } from "./logs.repository";
import { LogService } from "./logs.service";

@Module({
  controllers: [LogController],
  providers: [LogService, LogRepository],
  exports: [LogService],
})
export class LogModule {}
