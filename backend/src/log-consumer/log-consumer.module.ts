import { Module } from "@nestjs/common";
import { AppLogConsumerModule } from "./app/app-log-consumer.module";
import { HttpLogConsumerModule } from "./http/http-log-consumer.module";

@Module({
  imports: [AppLogConsumerModule, HttpLogConsumerModule],
})
export class LogConsumerModule {}
