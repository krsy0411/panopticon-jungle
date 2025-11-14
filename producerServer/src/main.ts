import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const PORT = process.env.PORT;

  // Protobuf 처리를 위한 raw body 파서
  app.use(
    bodyParser.raw({
      type: [
        'application/x-protobuf',
        'application/protobuf',
        'application/octet-stream',
      ],
      limit: '50mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // prefix 고정
  app.setGlobalPrefix('producer', {
    exclude: [
      { path: '/health', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });

  await app.listen(PORT || 3000);
}
bootstrap();
