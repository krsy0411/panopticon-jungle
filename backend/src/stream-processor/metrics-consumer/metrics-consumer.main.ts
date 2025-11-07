import { config } from "dotenv";
config(); // Load .env file before anything else

import { createMetricsConsumerMicroservice } from "./metrics-consumer.bootstrap";

async function bootstrap(): Promise<void> {
  const app = await createMetricsConsumerMicroservice();

  await app.listen();
  console.log("✅ Metrics Consumer is running and listening for messages...");
}

void bootstrap();
