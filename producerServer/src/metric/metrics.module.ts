import { Module } from '@nestjs/common';
import { MetricsInterceptor } from './metrics.interceptors';

/**
 * 전역 메트릭 모듈
 * 모든 모듈에서 동일한 MetricsInterceptor 인스턴스 공유
 */
@Module({
  providers: [MetricsInterceptor],
  exports: [MetricsInterceptor],
})
export class MetricsModule {}
