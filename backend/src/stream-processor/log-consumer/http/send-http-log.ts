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
console.log(`[send-http-log] using brokers: ${brokers.join(", ")}`);

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer-http",
});

const producer = kafka.producer();

async function main(): Promise<void> {
  await producer.connect();
  await producer.send({
    topic: process.env.KAFKA_HTTP_LOG_TOPIC ?? "logs.http",
    messages: [
      {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          request_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          client_ip: "127.0.0.1",
          method: "GET",
          path: "/api/test",
          status_code: 200,
          request_time: 0.01,
          user_agent: "curl/8.7.1",
          upstream_service: "local-test-service",
          upstream_status: 200,
          upstream_response_time: 0.009,
        }),
      },
    ],
  });

  await producer.disconnect();
  console.log("✅ Sample HTTP log produced");
}

main().catch((error) => {
  console.error("Failed to send HTTP log", error);
  process.exitCode = 1;
});
