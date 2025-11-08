import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../../../shared/logs/logs.module";
import { HttpLogController } from "./http-log.controller";
import { HttpLogQueryService } from "./http-log.service";
import { HttpLogRepository } from "../../../shared/logs/http/http-log.repository";

@Module({
  imports: [LogInfrastructureModule],
  controllers: [HttpLogController],
  providers: [HttpLogQueryService, HttpLogRepository],
  exports: [HttpLogQueryService],
})
export class HttpLogQueryModule {}
