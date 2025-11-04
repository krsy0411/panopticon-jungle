import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../logs.module";
import { HttpLogController } from "./http-log.controller";
import { HttpLogService } from "./http-log.service";
import { HttpLogRepository } from "./http-log.repository";

@Module({
  imports: [LogInfrastructureModule],
  controllers: [HttpLogController],
  providers: [HttpLogService, HttpLogRepository],
  exports: [HttpLogService, HttpLogRepository],
})
export class HttpLogModule {}
