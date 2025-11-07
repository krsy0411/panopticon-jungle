import { config } from "dotenv";
config();

import { createLogConsumerMicroservice } from "./log-consumer.bootstrap";

async function bootstrap(): Promise<void> {
  const app = await createLogConsumerMicroservice();
  await app.listen();
}

void bootstrap();
