import { INestMicroservice } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions } from "@nestjs/microservices";
import { createKafkaMicroserviceOptions } from "../../shared/common/kafka/kafka.config";
import { MetricsConsumerModule } from "./metrics-consumer.module";

export async function createMetricsConsumerMicroservice(): Promise<INestMicroservice> {
  const clientId = process.env.KAFKA_METRICS_CLIENT_ID ?? "metrics-consumer";
  const groupId =
    process.env.KAFKA_METRICS_CONSUMER_GROUP ?? "metrics-consumer-group";
  const allowAutoTopicCreation =
    process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false";

  return NestFactory.createMicroservice<MicroserviceOptions>(
    MetricsConsumerModule,
    createKafkaMicroserviceOptions({
      clientId,
      groupId,
      allowAutoTopicCreation,
    }),
  );
}
