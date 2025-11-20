import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { loadEnv } from "../shared/config/load-env";
import { AggregatorModule } from "./aggregator.module";
import { AggregatorRunner } from "./aggregator-runner.service";

async function bootstrap(): Promise<void> {
  loadEnv();
  Logger.log(".env/.env.local 로부터 환경 변수를 불러왔습니다.", "Bootstrap");
  const app = await NestFactory.createApplicationContext(AggregatorModule, {
    bufferLogs: true,
  });

  await app.init();
  if ("flushLogs" in app && typeof app.flushLogs === "function") {
    app.flushLogs();
  }

  // AggregatorRunner 는 다른 프로바이더에서 주입받지 않으므로, 부트스트랩 시점에 명시적으로 인스턴스를 요청해 onModuleInit 훅을 보장한다.
  app.get(AggregatorRunner);
  app.enableShutdownHooks();
  Logger.log("Aggregator 애플리케이션이 구동되었습니다.", "Bootstrap");
}

void bootstrap();
