import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod } from '@nestjs/common';
import * as bodyParser from 'body-parser';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  // prefix 고정
  app.setGlobalPrefix('producer', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  await app.listen(3000);
}
bootstrap();
