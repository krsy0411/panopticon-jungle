import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { KafkaModule } from "./kafka-set/kafka.module";
import { LogModule } from "./logs/logs.module";
import { MetricsModule } from "./metrics/metrics.module";

@Module({
  imports: [KafkaModule, LogModule, MetricsModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
