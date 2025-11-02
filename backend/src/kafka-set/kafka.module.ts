import { Global, Module } from "@nestjs/common";
import { LogModule } from "../logs/logs.module";
import { KafkaService } from "./kafka.service";

@Global()
@Module({
  imports: [LogModule],
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
