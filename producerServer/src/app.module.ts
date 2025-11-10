import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaModule } from './kafka/kafka.module';
import { S3Module } from './s3/s3.module';
import { DataModule } from './data/data.module';
import { OpenSearchModule } from './opensearch/opensearch.module';
import { RdbModule } from './rdb/rdb.module';
import { TsdbModule } from './tsdb/tsdb.module';

@Module({
  imports: [
    // ConfigModule은 시스템환경변수를 높은 우선순위로 둔다.
    ConfigModule.forRoot({
      isGlobal: true,
      // NODE_ENV에 따라 다른 .env 파일 로드
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? undefined // 배포 환경: .env 파일 사용 안 함
          : '.env.development', // 로컬 개발: .env.development 사용
      ignoreEnvFile: process.env.NODE_ENV === 'production', // 배포 시 .env 파일 무시
    }),
    // KafkaModule, // 임시 비활성화
    S3Module,
    OpenSearchModule,
    RdbModule,
    TsdbModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
