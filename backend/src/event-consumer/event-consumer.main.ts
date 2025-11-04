import { config } from "dotenv";
config(); // Load .env file before anything else

import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { LogConsumerModule } from "./event-consumer.module";

function parseBrokers(): string[] {
  const brokersEnv = process.env.KAFKA_BROKERS;
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

  const clientId = process.env.KAFKA_CLIENT_ID ?? "log-consumer";
  const groupId = process.env.KAFKA_CONSUMER_GROUP ?? "log-consumer-group";

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    LogConsumerModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId,
          brokers,
        },
        consumer: {
          groupId,
          allowAutoTopicCreation:
            process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false",
        },
      },
    },
  );

  await app.listen();
}

void bootstrap();
