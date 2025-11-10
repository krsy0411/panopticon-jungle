import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import type { KafkaConfig } from "kafkajs";

const DEFAULT_BROKER = "localhost:9092";

function resolveBrokerList(raw?: string): string[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  const isRunningInsideDocker = process.env.KAFKA_IN_DOCKER === "true";

  return raw
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean)
    .map((broker) => {
      if (!isRunningInsideDocker && broker.startsWith("kafka:")) {
        return broker.replace(/^kafka(?=:)/, "localhost");
      }
      return broker;
    });
}

export function parseKafkaBrokers(): string[] {
  const preferLocalOverride =
    process.env.KAFKA_BROKERS_LOCAL && process.env.KAFKA_IN_DOCKER !== "true";
  const brokersEnv = preferLocalOverride
    ? process.env.KAFKA_BROKERS_LOCAL
    : process.env.KAFKA_BROKERS;
  const fallback = process.env.KAFKA_BROKER_FALLBACK ?? DEFAULT_BROKER;

  const brokers = resolveBrokerList(brokersEnv);
  if (process.env.DEBUG_KAFKA_BROKERS === "true") {
    console.log("[kafka-config] brokersEnv:", brokersEnv, "resolved:", brokers);
  }

  if (brokers.length === 0) {
    const fallbackList = resolveBrokerList(fallback);
    if (fallbackList.length === 0) {
      throw new Error("Kafka configuration error: no brokers provided");
    }
    return fallbackList;
  }

  return brokers;
}

interface KafkaMicroserviceParams {
  clientId: string;
  groupId: string;
  allowAutoTopicCreation?: boolean;
  brokers?: string[];
}

function buildKafkaSecurityConfig(): Pick<KafkaConfig, "ssl" | "sasl"> {
  const sslEnabled = process.env.KAFKA_SSL === "true";
  const sslRejectUnauthorized =
    process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== "false";

  const ssl = sslEnabled
    ? { rejectUnauthorized: sslRejectUnauthorized }
    : undefined;

  const mechanism = process.env.KAFKA_SASL_MECHANISM;
  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;

  const sasl =
    mechanism && username && password
      ? ({
          mechanism,
          username,
          password,
        } as KafkaConfig["sasl"])
      : undefined;

  return { ssl, sasl };
}

export function getKafkaSecurityOverrides(): Pick<
  KafkaConfig,
  "ssl" | "sasl"
> {
  return buildKafkaSecurityConfig();
}

export function createKafkaMicroserviceOptions(
  params: KafkaMicroserviceParams,
): MicroserviceOptions {
  const brokers = params.brokers ?? parseKafkaBrokers();
  const { ssl, sasl } = buildKafkaSecurityConfig();

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
        ssl,
        sasl,
      },
      consumer: {
        groupId: params.groupId,
        allowAutoTopicCreation: params.allowAutoTopicCreation ?? true,
      },
    },
  };
}
