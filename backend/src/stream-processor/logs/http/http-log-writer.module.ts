import { Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../../../shared/logs/logs.module";
import { HttpLogRepository } from "../../../shared/logs/http/http-log.repository";
import { HttpLogWriterService } from "./http-log-writer.service";

@Module({
  imports: [LogInfrastructureModule],
  providers: [HttpLogWriterService, HttpLogRepository],
  exports: [HttpLogWriterService],
})
export class HttpLogWriterModule {}
