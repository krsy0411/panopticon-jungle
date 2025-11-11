import { Module } from "@nestjs/common";
import { LogIngestModule } from "../apm/log-ingest/log-ingest.module";
import { LogConsumerController } from "./log-consumer.controller";

@Module({
  imports: [LogIngestModule],
  controllers: [LogConsumerController],
})
export class LogConsumerModule {}
