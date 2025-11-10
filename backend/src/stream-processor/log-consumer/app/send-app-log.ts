import { Kafka } from "kafkajs";
import { loadEnv } from "../../../shared/config/load-env";
import {
  getKafkaSecurityOverrides,
  parseKafkaBrokers,
} from "../../../shared/common/kafka/kafka.config";

loadEnv();

const brokers = parseKafkaBrokers();
console.log(`[send-app-log] using brokers: ${brokers.join(", ")}`);

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer",
  ...getKafkaSecurityOverrides(),
});

const producer = kafka.producer();

async function main(): Promise<void> {
  await producer.connect();
  await producer.send({
    topic: process.env.KAFKA_APP_LOG_TOPIC ?? "logs.app",
    messages: [
      {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          service: "payment-service",
          level: "info",
          message: "test message 요 변",
        }),
      },
    ],
  });
  await producer.disconnect();
  console.log("✅ Sample app log produced");
}

main().catch((error) => {
  console.error("Failed to send app log", error);
  process.exitCode = 1;
});
