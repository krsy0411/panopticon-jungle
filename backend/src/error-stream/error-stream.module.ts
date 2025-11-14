import { Module } from "@nestjs/common";
import { ErrorLogGateway } from "./gateway/error-log.gateway";
import { ErrorLogStreamService } from "./services/error-log-stream.service";
import { ErrorLogConsumerController } from "./kafka/error-log-consumer.controller";
import { ErrorLogParserService } from "./services/error-log-parser.service";
import { ErrorStreamController } from "./error-stream.controller";

@Module({
  providers: [ErrorLogGateway, ErrorLogStreamService, ErrorLogParserService],
  controllers: [ErrorLogConsumerController, ErrorStreamController],
})
export class ErrorStreamModule {}
