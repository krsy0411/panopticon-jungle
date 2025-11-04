import { Module } from "@nestjs/common";
import { AppLogModule } from "../../logs/app/app-log.module";
import { AppLogConsumer } from "./app-log.consumer";

@Module({
  imports: [AppLogModule],
  controllers: [AppLogConsumer],
})
export class AppLogConsumerModule {}
