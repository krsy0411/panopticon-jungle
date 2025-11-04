import { Module } from "@nestjs/common";
import { HttpLogModule } from "../../logs/http/http-log.module";
import { HttpLogConsumer } from "./http-log.consumer";

@Module({
  imports: [HttpLogModule],
  controllers: [HttpLogConsumer],
})
export class HttpLogConsumerModule {}
