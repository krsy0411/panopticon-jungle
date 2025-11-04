import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { EventConsumer } from "./event.consumer";

/**
 * 이벤트 컨슈머 모듈
 * Kafka의 로그와 메트릭 이벤트를 처리합니다
 */
@Module({
  imports: [MetricsModule],
  controllers: [EventConsumer],
})
export class EventConsumerModule {}
