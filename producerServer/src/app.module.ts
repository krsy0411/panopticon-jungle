import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaModule } from './kafka/kafka.module';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    KafkaModule,
    S3Module,
    // ConfigModule은 시스템환경변수를 높은 우선순위로 둔다.
    ConfigModule.forRoot({
      isGlobal: true,
      // NODE_ENV에 따라 다른 .env 파일 로드
      // - development: .env.development (로컬 개발)
      // - production: 시스템 환경변수 사용 (K8s/ECS에서 주입)
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? undefined // 배포 환경: .env 파일 사용 안 함
          : '.env.development', // 로컬 개발: .env.development 사용
      ignoreEnvFile: process.env.NODE_ENV === 'production', // 배포 시 .env 파일 무시
      // 환경변수 검증
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
