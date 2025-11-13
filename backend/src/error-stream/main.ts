import { loadEnv } from "../shared/config/load-env";
loadEnv();

import { NestFactory } from "@nestjs/core";
import { ErrorStreamModule } from "./error-stream.module";
import { createKafkaMicroserviceOptions } from "../shared/common/kafka/kafka.config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ErrorStreamModule);

  const kafkaMicroservice = createKafkaMicroserviceOptions({
    clientId:
      process.env.ERROR_STREAM_KAFKA_CLIENT_ID ?? "error-stream-kafka-client",
    groupId:
      process.env.ERROR_STREAM_KAFKA_GROUP_ID ?? "error-stream-kafka-group",
  });

  app.connectMicroservice(kafkaMicroservice);

  await app.startAllMicroservices();

  const port = Number(process.env.ERROR_STREAM_PORT ?? 3010);
  await app.listen(port);
  console.log(
    `⚡ Error Stream 서버가 WebSocket(${port})과 Kafka 소비자와 함께 실행 중입니다.`,
  );
}

void bootstrap();
