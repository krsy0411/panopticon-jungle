import { INestMicroservice } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions } from "@nestjs/microservices";
import { createKafkaMicroserviceOptions } from "../../shared/common/kafka/kafka.config";
import { LogConsumerModule } from "./log-consumer.module";

export async function createLogConsumerMicroservice(): Promise<INestMicroservice> {
  const clientId = process.env.KAFKA_CLIENT_ID ?? "log-consumer";
  const groupId = process.env.KAFKA_CONSUMER_GROUP ?? "log-consumer-group";
  const allowAutoTopicCreation =
    process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false";

  return NestFactory.createMicroservice<MicroserviceOptions>(
    LogConsumerModule,
    createKafkaMicroserviceOptions({
      clientId,
      groupId,
      allowAutoTopicCreation,
    }),
  );
}
