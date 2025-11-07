import { Module } from "@nestjs/common";
import { AppLogWriterModule } from "../../logs/app/app-log-writer.module";
import { AppLogConsumer } from "./app-log.consumer";

@Module({
  imports: [AppLogWriterModule],
  controllers: [AppLogConsumer],
})
export class AppLogConsumerModule {}
