import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { KafkaModule } from './kafka/kafka.module';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    KafkaModule,
    S3Module,
    // ConfigModule은 시스템환경변수를 높은 우선순위로 둔다.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // 환경변수 검증
      validate,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
