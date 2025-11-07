import { MicroserviceOptions, Transport } from "@nestjs/microservices";

const DEFAULT_BROKER = "localhost:9092";

export function parseKafkaBrokers(): string[] {
  const brokersEnv = process.env.KAFKA_BROKERS;
  const fallback = process.env.KAFKA_BROKER_FALLBACK ?? DEFAULT_BROKER;

  if (!brokersEnv || brokersEnv.trim().length === 0) {
    return [fallback];
  }

  const brokers = brokersEnv
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (brokers.length === 0) {
    throw new Error("Kafka configuration error: no brokers provided");
  }

  return brokers;
}

interface KafkaMicroserviceParams {
  clientId: string;
  groupId: string;
  allowAutoTopicCreation?: boolean;
  brokers?: string[];
}

export function createKafkaMicroserviceOptions(
  params: KafkaMicroserviceParams,
): MicroserviceOptions {
  const brokers = params.brokers ?? parseKafkaBrokers();

  if (brokers.length === 0) {
    throw new Error(
      "Kafka microservice configuration requires at least one broker",
    );
  }

  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: params.clientId,
        brokers,
      },
      consumer: {
        groupId: params.groupId,
        allowAutoTopicCreation: params.allowAutoTopicCreation ?? true,
      },
    },
  };
}
