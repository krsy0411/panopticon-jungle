import { config } from "dotenv";
config(); // Load .env file before anything else

import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { EventConsumerModule } from "./event-consumer.module";

function parseBrokers(): string[] {
  const brokersEnv =
    process.env.KAFKA_EVENT_CONSUMER_BROKERS ?? process.env.KAFKA_BROKERS;
  if (!brokersEnv) {
    return ["localhost:9092"];
  }

  return brokersEnv
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const brokers = parseBrokers();
  if (brokers.length === 0) {
    throw new Error("Kafka consumer startup failed: no brokers configured");
  }

  const clientId =
    process.env.KAFKA_EVENT_CONSUMER_CLIENT_ID ??
    process.env.KAFKA_CLIENT_ID ??
    "event-consumer";
  const groupId =
    process.env.KAFKA_EVENT_CONSUMER_GROUP ??
    process.env.KAFKA_CONSUMER_GROUP ??
    "event-consumer-group";
  const allowAutoTopicCreation =
    (process.env.KAFKA_EVENT_CONSUMER_ALLOW_AUTO_TOPIC_CREATION ??
      process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION) !== "false";

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EventConsumerModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId,
          brokers,
        },
        consumer: {
          groupId,
          allowAutoTopicCreation,
        },
      },
    },
  );

  await app.listen();
}

void bootstrap();
