import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import { ErrorLogStreamService } from "../services/error-log-stream.service";
import {
  ErrorLogParserService,
  InvalidErrorLogPayloadError,
} from "../services/error-log-parser.service";

/**
 * apm.logs.error 토픽을 구독하여 WebSocket으로 전달한다.
 */
@Controller()
export class ErrorLogConsumerController {
  private readonly logger = new Logger(ErrorLogConsumerController.name);

  constructor(
    private readonly parser: ErrorLogParserService,
    private readonly streamService: ErrorLogStreamService,
  ) {}

  @EventPattern(process.env.KAFKA_APM_LOG_ERROR_TOPIC ?? "apm.logs.error")
  async handleErrorLog(@Ctx() context: KafkaContext): Promise<void> {
    const { value } = context.getMessage();
    if (value == null) {
      this.logger.warn("Kafka 메시지에 value가 비어 있어 건너뜁니다.");
      return;
    }

    try {
      const dto = this.parser.parse(value);
      this.streamService.broadcast(dto);
    } catch (error) {
      if (error instanceof InvalidErrorLogPayloadError) {
        this.logger.warn(
          `유효하지 않은 에러 로그를 무시합니다: ${error.message}`,
        );
        return;
      }
      this.logger.error(
        "에러 로그 처리에 실패했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
