import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // prefix 고정
  app.setGlobalPrefix('producer', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  await app.listen(3000);
}
bootstrap();
