#!/usr/bin/env ts-node
/**
 * Kafka에 테스트 메트릭 데이터를 전송하는 스크립트
 *
 * 실행 방법:
 * npx ts-node -r tsconfig-paths/register send-test-metrics.ts
 */

import { Kafka } from "kafkajs";

interface SystemMetric {
  time: number;
  service: string;
  podName: string;
  cpuUsagePercent: number;
  memoryUsageBytes: number;
  diskUsagePercent?: number;
  networkRxBytes?: number;
  networkTxBytes?: number;
}

interface HttpLog {
  timestamp: string;
  method?: string;
  path?: string;
  status_code?: number;
  request_time?: number;
  upstream_service?: string;
}

async function main() {
  const kafka = new Kafka({
    clientId: "test-metrics-producer",
    brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
  });

  const producer = kafka.producer();
  await producer.connect();

  try {
    // 1. 시스템 메트릭 데이터 생성 (지난 12시간, 1시간 간격)
    console.log("📊 시스템 메트릭 데이터 전송 중...");
    const systemMetrics: SystemMetric[] = [];
    const now = new Date();
    const startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12시간 전

    for (let i = 0; i < 12; i++) {
      const time = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      systemMetrics.push({
        time: time.getTime(),
        service: "api-service",
        podName: `api-pod-${i % 3}`,
        cpuUsagePercent: 40 + Math.random() * 20, // 40-60% CPU
        memoryUsageBytes: (60 + Math.random() * 20) * 1024 * 1024 * 10, // 600-800 MB
        diskUsagePercent: 50 + Math.random() * 10, // 50-60% Disk
        networkRxBytes: 1000000 + Math.random() * 500000, // 1-1.5 MB/s
        networkTxBytes: 500000 + Math.random() * 250000, // 0.5-0.75 MB/s
      });
    }

    // 시스템 메트릭 전송
    await producer.send({
      topic: process.env.KAFKA_SYSTEM_METRICS_TOPIC || "metrics.system",
      messages: systemMetrics.map((metric) => ({
        key: `${metric.service}-${metric.podName}`,
        value: JSON.stringify(metric),
      })),
    });

    console.log(
      `✅ ${systemMetrics.length}개의 시스템 메트릭 데이터 전송 완료`,
    );

    // 2. HTTP 로그 데이터 생성 (지난 12시간, 1시간 간격, 각 시간마다 여러 요청)
    console.log("\n📝 HTTP 로그 데이터 전송 중...");
    const httpLogs: HttpLog[] = [];

    for (let hour = 0; hour < 12; hour++) {
      const time = new Date(startTime.getTime() + hour * 60 * 60 * 1000);
      const requestsPerHour = 30 + Math.floor(Math.random() * 30); // 30-60개 요청

      for (let j = 0; j < requestsPerHour; j++) {
        const minuteOffset = Math.floor(Math.random() * 60);
        const requestTime = new Date(time.getTime() + minuteOffset * 60 * 1000);

        // 대부분 성공 (200), 일부 에러 (500)
        const isError = Math.random() < 0.05; // 5% 에러율
        const statusCode = isError ? 500 : 200;

        httpLogs.push({
          timestamp: requestTime.toISOString(),
          method: ["GET", "POST", "PUT", "DELETE"][
            Math.floor(Math.random() * 4)
          ],
          path: ["/api/users", "/api/products", "/api/orders"][
            Math.floor(Math.random() * 3)
          ],
          status_code: statusCode,
          request_time: 10 + Math.random() * 100, // 10-110ms
          upstream_service: "api-service",
        });
      }
    }

    // HTTP 로그 전송
    await producer.send({
      topic: process.env.KAFKA_HTTP_LOG_TOPIC || "logs.http",
      messages: httpLogs.map((log, idx) => ({
        key: `http-log-${idx}`,
        value: JSON.stringify(log),
      })),
    });

    console.log(`✅ ${httpLogs.length}개의 HTTP 로그 데이터 전송 완료`);

    console.log("\n🎉 모든 테스트 데이터 전송 완료!");
    console.log("\n다음 명령으로 API 테스트:");
    console.log(
      "  curl 'http://localhost:3000/api/metrics/timeseries?range=12h&interval=1h' | jq",
    );
  } catch (error) {
    console.error("❌ 에러 발생:", error);
    throw error;
  } finally {
    await producer.disconnect();
  }
}

void main();
