import { Kafka } from "kafkajs";

const kafka = new Kafka({
  brokers: ["localhost:9092"],
  clientId: "cli-producer",
});
const producer = kafka.producer();

/*
 * Kafka에 테스트용 메트릭 데이터를 직접 전송하는 용도
 * Kafka 토픽 : metrics.api, metrics.system
 * 메트릭 컨슈머가 잘 consume해서 DB에 저장하는지 빠르게 테스트하기 위해 사용(producer script)
 */
async function main() {
  await producer.connect();
  // API 메트릭 전송
  await producer.send({
    topic: "metrics.api",
    messages: [
      {
        value: JSON.stringify({
          time: new Date().toISOString(),
          service: "test-service",
          endpoint: "/api/test",
          method: "GET",
          latencyMs: 123.45,
          statusCode: 200,
        }),
      },
    ],
  });
  // 시스템 메트릭 전송
  await producer.send({
    topic: "metrics.system",
    messages: [
      {
        value: JSON.stringify({
          time: Date.now(),
          service: "test-service",
          podName: "test-pod-1",
          nodeName: "node-1",
          namespace: "default",
          cpuUsagePercent: 55.5,
          memoryUsageBytes: 73741824, // 70.3 MB in bytes
          diskUsagePercent: 80.1,
          networkRxBytes: 1000000,
          networkTxBytes: 500000,
        }),
      },
    ],
  });
  await producer.disconnect();
}

main().catch(console.error);
