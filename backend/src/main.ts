import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as dotenv from "dotenv";

// .env 파일 로드
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidUnknownValues: false,
    }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
