import { config } from "dotenv";
config();

import { createLogConsumerMicroservice } from "./log-consumer/log-consumer.bootstrap";
import { createMetricsConsumerMicroservice } from "./metrics-consumer/metrics-consumer.bootstrap";

async function bootstrap(): Promise<void> {
  const logConsumer = await createLogConsumerMicroservice();
  const metricsConsumer = await createMetricsConsumerMicroservice();

  await Promise.all([logConsumer.listen(), metricsConsumer.listen()]);
  console.log("✅ Stream processor is running (logs + metrics consumers)");
}

void bootstrap();
