import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod } from '@nestjs/common';

async function bootstrap() {
  // const logger = new Logger('Bootstrap');

  // try {
  //   // 1. 토픽 생성 (앱 시작 전)
  //   logger.log('Ensuring Kafka topics exist...');
  //   await createTopics();
  //   logger.log('✅ Kafka topics ready');
  // } catch (error) {
  //   logger.warn('Failed to create topics (might already exist)', error);
  //   // 토픽 생성 실패해도 앱은 시작 (이미 존재할 수 있음)
  // }

  // 2. 앱 시작
  const app = await NestFactory.create(AppModule);

  // prefix 고정
  app.setGlobalPrefix('producer', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  await app.listen(3000);
}
bootstrap();
