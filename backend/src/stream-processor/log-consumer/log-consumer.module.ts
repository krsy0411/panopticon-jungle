import { Module } from "@nestjs/common";
import { LogIngestModule } from "../apm/log-ingest/log-ingest.module";
import { LogConsumerController } from "./log-consumer.controller";
import { ErrorLogForwarderService } from "./error-log-forwarder.service";

@Module({
  imports: [LogIngestModule],
  providers: [ErrorLogForwarderService],
  controllers: [LogConsumerController],
})
export class LogConsumerModule {}
