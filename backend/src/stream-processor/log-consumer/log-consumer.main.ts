import { loadEnv } from "../../shared/config/load-env";
loadEnv();

import { createLogConsumerMicroservice } from "./log-consumer.bootstrap";

async function bootstrap(): Promise<void> {
  const app = await createLogConsumerMicroservice();
  await app.listen();
}

void bootstrap();
