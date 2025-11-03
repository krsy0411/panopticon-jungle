import { Module } from "@nestjs/common";
import { LogModule } from "../logs/logs.module";
import { LogConsumer } from "./log.consumer";

@Module({
  imports: [LogModule],
  controllers: [LogConsumer],
})
export class LogConsumerModule {}
