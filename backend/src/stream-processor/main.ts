import { loadEnv } from "../shared/config/load-env";
loadEnv();

import { createLogConsumerMicroservice } from "./log-consumer/log-consumer.bootstrap";
import { createSpanConsumerMicroservice } from "./span-consumer/span-consumer.bootstrap";

async function bootstrap(): Promise<void> {
  const logConsumer = await createLogConsumerMicroservice();
  const spanConsumer = await createSpanConsumerMicroservice();

  await Promise.all([logConsumer.listen(), spanConsumer.listen()]);
  console.log("✅ 스트림 프로세서가 로그/스팬 컨슈머와 함께 실행 중입니다.");
}

void bootstrap();
