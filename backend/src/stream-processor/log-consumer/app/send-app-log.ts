import { existsSync } from "fs";
import { Kafka } from "kafkajs";
import { loadEnv } from "../../../shared/config/load-env";

loadEnv();

const runningInsideDocker = existsSync("/.dockerenv");

function resolveBrokers(): string[] {
  const raw =
    process.env.KAFKA_BROKERS_LOCAL ??
    process.env.KAFKA_BROKERS ??
    "localhost:9092";
  return raw
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean)
    .map((broker) => {
      if (!runningInsideDocker && broker.startsWith("kafka:")) {
        return broker.replace(/^kafka(?=:)/, "localhost");
      }
      return broker;
    });
}

const brokers = resolveBrokers();
console.log(`[send-app-log] using brokers: ${brokers.join(", ")}`);

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer",
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
          message: "test message 요기 변",
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
