import { Kafka } from "kafkajs";

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKERS ?? "localhost:9092"],
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
          request_id: "e0ef68f07d57fb758d07478a623c2ee6",
          client_ip: "172.18.0.1",
          method: "GET",
          path: "/api/users/5555",
          status_code: 200,
          request_time: 0.014,
          user_agent: "curl/8.7.1",
          upstream_service: "default-log-generator-service-80",
          upstream_status: 200,
          upstream_response_time: 0.013,
        }),
      },
    ],
  });

  await producer.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
