import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
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

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle("Panopticon API")
    .setDescription("SRE 모니터링 플랫폼 - 실시간 로그 및 메트릭 수집·분석 API")
    .setVersion("1.0")
    .addTag("metrics", "메트릭 관련 API (API 메트릭, 시스템 메트릭)")
    .addTag("logs", "로그 관련 API")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(process.env.PORT ?? 3001);

  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3001}`,
  );
  console.log(
    `Swagger UI available at: http://localhost:${process.env.PORT ?? 3001}/api-docs`,
  );
}
void bootstrap();
