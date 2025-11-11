import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { LogIngestService } from "../apm/log-ingest/log-ingest.service";
import { LogEventDto } from "../../shared/apm/logs/dto/log-event.dto";

/**
 * APM 로그 전용 Kafka 컨슈머
 */
@Controller()
export class LogConsumerController {
  private readonly logger = new Logger(LogConsumerController.name);

  constructor(private readonly logIngestService: LogIngestService) {}

  @EventPattern(process.env.KAFKA_APM_LOG_TOPIC ?? "apm.logs")
  async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka 메시지에 본문이 없어 처리를 건너뜁니다.");
      return;
    }

    try {
      const dto = this.parsePayload(value);
      await this.logIngestService.ingest(dto);
      this.logger.debug(
        `로그가 색인되었습니다. topic=${context.getTopic()} partition=${context.getPartition()}`,
      );
    } catch (error) {
      this.logger.error(
        "로그 이벤트 처리에 실패했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Kafka 메시지를 DTO로 변환하고 유효성 검증을 수행한다.
   */
  private parsePayload(payload: unknown): LogEventDto {
    const resolved = this.unwrapValue(payload);
    let plain: unknown;

    if (typeof resolved === "string") {
      plain = JSON.parse(resolved);
    } else if (resolved instanceof Buffer) {
      plain = JSON.parse(resolved.toString());
    } else if (ArrayBuffer.isView(resolved)) {
      plain = JSON.parse(Buffer.from(resolved.buffer).toString());
    } else {
      plain = resolved;
    }

    if (!plain || typeof plain !== "object") {
      throw new Error("Kafka 로그 payload가 객체 형식이 아닙니다.");
    }

    const dto = plainToInstance(LogEventDto, plain as Record<string, unknown>);
    const errors = validateSync(dto, { whitelist: true });
    if (errors.length > 0) {
      throw new Error(
        `로그 이벤트 형식이 올바르지 않습니다: ${errors
          .map((err) => Object.values(err.constraints ?? {}).join(", "))
          .join("; ")}`,
      );
    }
    return dto;
  }

  /**
   * kafkajs 래퍼에 감싸진 value 필드를 추출한다.
   */
  private unwrapValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
}
