import { Kafka } from "kafkajs";
import { loadEnv } from "../../shared/config/load-env";
import {
  getKafkaSecurityOverrides,
  parseKafkaBrokers,
} from "../../shared/common/kafka/kafka.config";

loadEnv();

const brokers = parseKafkaBrokers();
console.log(`[send-apm-span] 사용 중인 브로커: ${brokers.join(", ")}`);

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer-apm-span",
  ...getKafkaSecurityOverrides(),
});

const producer = kafka.producer();

async function main(): Promise<void> {
  await producer.connect();
  await producer.send({
    topic: process.env.KAFKA_APM_SPAN_TOPIC ?? "apm.spans",
    messages: [
      {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          service_name: "demo-service",
          environment: process.env.LOG_ENVIRONMENT ?? "local",
          trace_id: `trace-${Date.now().toString(16)}`,
          span_id: `span-${Math.random().toString(16).slice(2, 10)}`,
          parent_span_id: null,
          name: "GET /api/test",
          kind: "SERVER",
          duration_ms: 48.5,
          status: "OK",
          http_method: "GET",
          http_path: "/api/test",
          http_status_code: 200,
          labels: {
            component: "api",
          },
        }),
      },
    ],
  });

  await producer.disconnect();
  console.log("✅ 샘플 APM 스팬이 전송되었습니다.");
}

main().catch((error) => {
  console.error("샘플 APM 스팬 전송에 실패했습니다.", error);
  process.exitCode = 1;
});
