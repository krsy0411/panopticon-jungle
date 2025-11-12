import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Protobuf raw body를 캡처하는 middleware (bodyParser 전에 실행!)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';

    // Protobuf content-type인 경우 raw body 저장
    if (
      contentType.includes('protobuf') ||
      contentType.includes('application/x-protobuf')
    ) {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        (req as any).rawBody = Buffer.concat(chunks);
        next();
      });
    } else {
      // JSON이나 다른 타입은 bodyParser가 처리
      next();
    }
  });

  // bodyParser는 Protobuf가 아닌 경우에만 동작
  app.use(
    bodyParser.json({
      limit: '10mb',
      verify: (req: any) => {
        // Protobuf인 경우 bodyParser 스킵
        const contentType = req.headers['content-type'] || '';
        if (
          contentType.includes('protobuf') ||
          contentType.includes('application/x-protobuf')
        ) {
          throw new Error('Skip JSON parsing for protobuf');
        }
      },
    }),
  );
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // prefix 고정
  app.setGlobalPrefix('producer', {
    exclude: [
      { path: '/health', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });

  await app.listen(3000);
}
bootstrap();
