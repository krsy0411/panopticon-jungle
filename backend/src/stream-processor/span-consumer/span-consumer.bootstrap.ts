import { INestMicroservice } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions } from "@nestjs/microservices";
import { createKafkaMicroserviceOptions } from "../../shared/common/kafka/kafka.config";
import { SpanConsumerModule } from "./span-consumer.module";

export async function createSpanConsumerMicroservice(): Promise<INestMicroservice> {
  const clientId = process.env.KAFKA_SPAN_CLIENT_ID ?? "span-consumer";
  const groupId =
    process.env.KAFKA_SPAN_CONSUMER_GROUP ?? "span-consumer-group";
  const allowAutoTopicCreation =
    process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false";

  return NestFactory.createMicroservice<MicroserviceOptions>(
    SpanConsumerModule,
    createKafkaMicroserviceOptions({
      clientId,
      groupId,
      allowAutoTopicCreation,
    }),
  );
}
