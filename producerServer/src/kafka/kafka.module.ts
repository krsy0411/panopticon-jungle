import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { KafkaService } from './kafka.service';
import { KafkaController } from './kafka.controller';
import { MetricsInterceptor } from '../metric/metrics.interceptors';

@Module({
  controllers: [KafkaController],
  providers: [
    KafkaService,
    MetricsInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: MetricsInterceptor,
    },
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
