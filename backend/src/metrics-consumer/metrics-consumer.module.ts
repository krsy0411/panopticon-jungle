import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { MetricsConsumer } from "./metrics.consumer";

/**
 * 메트릭 전용 컨슈머 모듈
 * Kafka의 API 메트릭과 시스템 메트릭 이벤트만 처리합니다
 * 실시간 집계 및 Redis 저장을 담당합니다
 */
@Module({
  imports: [MetricsModule],
  controllers: [MetricsConsumer],
})
export class MetricsConsumerModule {}
