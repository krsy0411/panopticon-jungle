import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");
const logTopic = process.env.KAFKA_LOG_TOPIC ?? "logs";
const apiMetricsTopic = process.env.KAFKA_API_METRICS_TOPIC ?? "metrics.api";
const systemMetricsTopic =
  process.env.KAFKA_SYSTEM_METRICS_TOPIC ?? "metrics.system";

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer",
});
const producer = kafka.producer();

async function main() {
  try {
    await producer.connect();

    // 로그 전송
    await producer.send({
      topic: logTopic,
      messages: [
        {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            service: "test-service",
            level: "info",
            message: "Test log message from Producer",
          }),
        },
      ],
    });

    // API 메트릭 전송
    await producer.send({
      topic: apiMetricsTopic,
      messages: [
        {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            service: "test-service",
            endpoint: "/api/users",
            method: "GET",
            latency: 125.5,
            status: 200,
          }),
        },
      ],
    });

    // 시스템 메트릭 전송
    await producer.send({
      topic: systemMetricsTopic,
      messages: [
        {
          value: JSON.stringify({
            timestamp: Date.now(),
            service: "test-service",
            podName: "test-pod-1",
            nodeName: "node-1",
            namespace: "default",
            cpu: 45.5,
            memory: 52.3,
            disk: 65.1,
            networkIn: 1024000,
            networkOut: 512000,
          }),
        },
      ],
    });

    await producer.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

void main();
