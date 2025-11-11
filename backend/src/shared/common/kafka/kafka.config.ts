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
    console.log(
      "[kafka-config] 환경 변수에서 읽은 브로커:",
      brokersEnv,
      "→ 변환 결과:",
      brokers,
    );
  }

  if (brokers.length === 0) {
    const fallbackList = resolveBrokerList(fallback);
    if (fallbackList.length === 0) {
      throw new Error("Kafka 브로커 설정을 찾을 수 없습니다.");
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

type KafkaSecurityOverrides = Pick<KafkaConfig, "ssl" | "sasl">;

function buildKafkaSecurityConfig(): KafkaSecurityOverrides {
  const sslEnabled = process.env.KAFKA_SSL === "true";
  const sslRejectUnauthorized =
    process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== "false";

  const ssl = sslEnabled
    ? { rejectUnauthorized: sslRejectUnauthorized }
    : undefined;

  const mechanism = process.env.KAFKA_SASL_MECHANISM;
  if (!mechanism) {
    return { ssl };
  }

  if (mechanism === "oauthbearer") {
    const region =
      process.env.KAFKA_AWS_REGION ??
      process.env.AWS_REGION ??
      "ap-northeast-2";

    return {
      ssl,
      sasl: {
        mechanism: "oauthbearer",
        oauthBearerProvider: async () => {
          try {
            const { generateAuthToken } = await import(
              "aws-msk-iam-sasl-signer-js"
            );
            const token = await generateAuthToken({ region });
            return { value: token.token };
          } catch (error) {
            throw new Error(`AWS MSK IAM 토큰 생성에 실패했습니다: ${error}`);
          }
        },
      },
    };
  }

  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;
  if (username && password) {
    return {
      ssl,
      sasl: {
        mechanism: mechanism,
        username,
        password,
      } as KafkaConfig["sasl"],
    };
  }

  return { ssl };
}

export function getKafkaSecurityOverrides(): KafkaSecurityOverrides {
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
