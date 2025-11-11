import { Module } from "@nestjs/common";
import { SpanIngestModule } from "../apm/span-ingest/span-ingest.module";
import { SpanConsumerController } from "./span-consumer.controller";

@Module({
  imports: [SpanIngestModule],
  controllers: [SpanConsumerController],
})
export class SpanConsumerModule {}
