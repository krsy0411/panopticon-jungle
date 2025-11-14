import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { QueryApiModule } from "./query-api.module";
import { loadEnv } from "../shared/config/load-env";

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(QueryApiModule);

  const corsEnv = process.env.CORS_ALLOWED_ORIGINS ?? "";
  const corsOrigins = corsEnv
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    maxAge: 3600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidUnknownValues: false,
    }),
  );

  app.setGlobalPrefix("query", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle("Panopticon APM Query API v2")
    .setDescription(
      "APM 로그·스팬 조회 및 서비스 메트릭을 제공하는 읽기 전용 API",
    )
    .setVersion("1.1")
    .addTag("traces", "트레이스 상세 조회 API")
    .addTag("services", "서비스 개요 / 엔드포인트 / 트레이스 검색 API")
    .addTag("service-metrics", "서비스 메트릭 시계열 API")
    .addTag("logs", "APM 로그 검색 API")
    .addTag("spans", "스팬 검색 API")
    .addTag("alb", "로드밸런서 헬스 체크")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(process.env.PORT ?? 3001);

  const port = process.env.PORT ?? 3001;
  console.log(`Query API 서버가 실행 중입니다: http://localhost:${port}`);
  console.log(`Swagger UI 주소: http://localhost:${port}/api-docs`);
}
void bootstrap();
