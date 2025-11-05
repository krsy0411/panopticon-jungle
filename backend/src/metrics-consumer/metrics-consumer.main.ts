import { config } from "dotenv";
config(); // Load .env file before anything else

import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { MetricsConsumerModule } from "./metrics-consumer.module";

function parseBrokers(): string[] {
  const brokersEnv = process.env.KAFKA_BROKERS;
  if (!brokersEnv) {
    return ["localhost:9092"];
  }

  const brokers = brokersEnv
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0) {
    throw new Error("Metrics consumer startup failed: no brokers configured");
  }

  return brokers;
}

async function bootstrap(): Promise<void> {
  const kafkaConfig = {
    brokers: parseBrokers(),
    clientId: process.env.KAFKA_METRICS_CLIENT_ID ?? "metrics-consumer",
    groupId:
      process.env.KAFKA_METRICS_CONSUMER_GROUP ?? "metrics-consumer-group",
    allowAutoTopicCreation:
      process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false",
  };
  const kafkaOptions = {
    transport: Transport.KAFKA as Transport.KAFKA,
    options: {
      client: {
        clientId: kafkaConfig.clientId,
        brokers: kafkaConfig.brokers,
      },
      consumer: {
        groupId: kafkaConfig.groupId,
        allowAutoTopicCreation: kafkaConfig.allowAutoTopicCreation,
      },
    },
  };

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MetricsConsumerModule,
    kafkaOptions,
  );

  await app.listen();
  console.log("✅ Metrics Consumer is running and listening for messages...");
}

void bootstrap();
