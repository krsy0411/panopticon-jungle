import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { SpanIngestService } from "../apm/span-ingest/span-ingest.service";
import { SpanEventDto } from "../../shared/apm/spans/dto/span-event.dto";

class InvalidSpanEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSpanEventError";
  }
}

/**
 * APM 스팬 전용 Kafka 컨슈머
 */
@Controller()
export class SpanConsumerController {
  private readonly logger = new Logger(SpanConsumerController.name);

  constructor(private readonly spanIngestService: SpanIngestService) {}

  @EventPattern(process.env.KAFKA_APM_SPAN_TOPIC ?? "apm.spans")
  async handleSpanEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka 메시지에 본문이 없어 처리를 건너뜁니다.");
      return;
    }

    try {
      const dto = this.parsePayload(value);
      await this.spanIngestService.ingest(dto);
      this.logger.debug(
        `스팬이 색인되었습니다. topic=${context.getTopic()} partition=${context.getPartition()}`,
      );
    } catch (error) {
      if (error instanceof InvalidSpanEventError) {
        this.logger.warn(
          `유효하지 않은 스팬 이벤트를 건너뜁니다: ${error.message}`,
        );
        return;
      }
      this.logger.error(
        "스팬 이벤트 처리에 실패했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Kafka payload를 DTO로 변환한다.
   */
  private parsePayload(payload: unknown): SpanEventDto {
    const resolved = this.unwrapValue(payload);
    let plain: unknown;

    try {
      if (typeof resolved === "string") {
        plain = JSON.parse(resolved);
      } else if (resolved instanceof Buffer) {
        plain = JSON.parse(resolved.toString());
      } else if (ArrayBuffer.isView(resolved)) {
        plain = JSON.parse(Buffer.from(resolved.buffer).toString());
      } else {
        plain = resolved;
      }
    } catch (error) {
      throw new InvalidSpanEventError(
        `Kafka 스팬 payload JSON 파싱 실패: ${String(error)}`,
      );
    }

    const dto = plainToInstance(SpanEventDto, plain);
    const errors = validateSync(dto, { whitelist: true });
    if (errors.length > 0) {
      throw new InvalidSpanEventError(
        `스팬 이벤트 형식이 올바르지 않습니다: ${errors
          .map((err) => Object.values(err.constraints ?? {}).join(", "))
          .join("; ")}`,
      );
    }
    return dto;
  }

  /**
   * kafkajs 메시지의 value 필드만 추출한다.
   */
  private unwrapValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
}
