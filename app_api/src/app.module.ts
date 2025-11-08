import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // ConfigModule 설정 - 환경변수 관리
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? undefined // 배포 환경: .env 파일 사용 안 함
          : '.env.development', // 로컬 개발: .env.development 사용
      ignoreEnvFile: process.env.NODE_ENV === 'production', // 배포 시 .env 파일 무시
    }),
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
