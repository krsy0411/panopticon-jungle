import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { QueryApiModule } from "./query-api.module";
import { loadEnv } from "../shared/config/load-env";

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(QueryApiModule);
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
    .setTitle("Panopticon APM Query API")
    .setDescription("트레이스 검색 및 서비스 메트릭 조회 전용 API")
    .setVersion("1.0")
    .addTag("traces", "Trace 관련 API")
    .addTag("service-metrics", "서비스 파생 메트릭 API")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(process.env.PORT ?? 3001);

  console.log(
    `Query API 서버가 실행 중입니다: http://localhost:${process.env.PORT ?? 3001}`,
  );
  console.log(
    `Swagger UI 주소: http://localhost:${process.env.PORT ?? 3001}/api-docs`,
  );
}
void bootstrap();
