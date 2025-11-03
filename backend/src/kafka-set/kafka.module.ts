import { Global, Module } from "@nestjs/common";
import { LogModule } from "../logs/logs.module";
import { MetricsModule } from "../metrics/metrics.module";
import { KafkaService } from "./kafka.service";

@Global()
@Module({
  imports: [LogModule, MetricsModule],
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
