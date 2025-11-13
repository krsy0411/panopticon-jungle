import { Kafka } from "kafkajs";
import { loadEnv } from "../../shared/config/load-env";
import {
  getKafkaSecurityOverrides,
  parseKafkaBrokers,
} from "../../shared/common/kafka/kafka.config";

loadEnv();

const brokers = parseKafkaBrokers();
console.log(`[send-sample-log] 사용 중인 브로커: ${brokers.join(", ")}`);

const kafka = new Kafka({
  brokers,
  clientId: "cli-producer-sample-log",
  ...getKafkaSecurityOverrides(),
});

const producer = kafka.producer();

async function main(): Promise<void> {
  const serviceName = process.env.SAMPLE_SERVICE_NAME ?? "demo-service";
  const environment = process.env.LOG_ENVIRONMENT ?? "local";
  const traceId = `trace-${Date.now().toString(16)}`;
  const spanId = `span-${Math.random().toString(16).slice(2, 10)}`;

  const payload = {
    type: "log",
    timestamp: new Date().toISOString(),
    service_name: serviceName,
    environment,
    level: "ERROR",
    message: "샘플 APM 로그 이벤트",
    trace_id: traceId,
    span_id: spanId,
    http_method: "GET",
    http_path: "/api/sample",
    http_status_code: 200,
    labels: {
      feature: "sample",
      host: "local",
    },
  };

  await producer.connect();
  await producer.send({
    topic: process.env.KAFKA_APM_LOG_TOPIC ?? "apm.logs",
    messages: [{ value: JSON.stringify(payload) }],
  });
  await producer.disconnect();
  console.log(
    `✅ 샘플 로그 이벤트 전송 완료(서비스: ${serviceName}, trace_id: ${traceId})`,
  );
}

main().catch((error) => {
  console.error("샘플 로그 이벤트 전송에 실패했습니다.", error);
  process.exitCode = 1;
});
