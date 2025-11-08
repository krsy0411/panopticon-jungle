import { loadEnv } from "../../shared/config/load-env";
loadEnv();

import { createMetricsConsumerMicroservice } from "./metrics-consumer.bootstrap";

async function bootstrap(): Promise<void> {
  const app = await createMetricsConsumerMicroservice();

  await app.listen();
  console.log("✅ Metrics Consumer is running and listening for messages...");
}

void bootstrap();
