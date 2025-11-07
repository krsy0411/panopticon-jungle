import { Module } from "@nestjs/common";
import { HttpLogWriterModule } from "../../logs/http/http-log-writer.module";
import { HttpLogConsumer } from "./http-log.consumer";

@Module({
  imports: [HttpLogWriterModule],
  controllers: [HttpLogConsumer],
})
export class HttpLogConsumerModule {}
