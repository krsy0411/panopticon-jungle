import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { KafkaModule } from "./kafka-set/kafka.module";

@Module({
  imports: [KafkaModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
