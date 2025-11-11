import { Kafka } from "kafkajs";
import { loadEnv } from "../../shared/config/load-env";
import {
  getKafkaSecurityOverrides,
  parseKafkaBrokers,
} from "../../shared/common/kafka/kafka.config";

loadEnv();

const brokers = parseKafkaBrokers();
console.log(`[send-apm-log] 사용 중인 브로커: ${brokers.join(", ")}`);

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer-apm-log",
  ...getKafkaSecurityOverrides(),
});

const producer = kafka.producer();

async function main(): Promise<void> {
  await producer.connect();
  await producer.send({
    topic: process.env.KAFKA_APM_LOG_TOPIC ?? "apm.logs",
    messages: [
      {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          service_name: "demo-service",
          environment: process.env.LOG_ENVIRONMENT ?? "local",
          level: "INFO",
          message: "샘플 APM 로그 이벤트",
          trace_id: `trace-${Date.now().toString(16)}`,
          span_id: `span-${Math.random().toString(16).slice(2, 10)}`,
          labels: {
            feature: "sample",
            host: "local",
          },
        }),
      },
    ],
  });
  await producer.disconnect();
  console.log("✅ 샘플 APM 로그가 전송되었습니다.");
}

main().catch((error) => {
  console.error("샘플 APM 로그 전송에 실패했습니다.", error);
  process.exitCode = 1;
});
