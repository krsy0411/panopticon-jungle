import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { LogEventDto } from "../../shared/apm/logs/dto/log-event.dto";

export class InvalidErrorLogPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidErrorLogPayloadError";
  }
}

/**
 * Kafka 레코드를 DTO로 변환하고 검증하는 책임만 담당 (SRP)
 */
@Injectable()
export class ErrorLogParserService {
  parse(payload: unknown): LogEventDto {
    const resolved = this.unwrapValue(payload);
    const json = this.parseJson(resolved);
    const dto = plainToInstance(LogEventDto, json);
    const errors = validateSync(dto, { whitelist: true });
    if (errors.length > 0) {
      throw new InvalidErrorLogPayloadError(
        errors
          .map((err) => Object.values(err.constraints ?? {}).join(", "))
          .join("; "),
      );
    }
    return dto;
  }

  private parseJson(value: unknown): Record<string, unknown> {
    try {
      if (typeof value === "string") {
        return JSON.parse(value);
      }
      if (value instanceof Buffer) {
        return JSON.parse(value.toString());
      }
      if (ArrayBuffer.isView(value)) {
        return JSON.parse(Buffer.from(value.buffer).toString());
      }
      if (value && typeof value === "object") {
        return value as Record<string, unknown>;
      }
    } catch (error) {
      throw new InvalidErrorLogPayloadError(
        `JSON 파싱에 실패했습니다: ${String(error)}`,
      );
    }
    throw new InvalidErrorLogPayloadError("Kafka payload가 객체 형식이 아닙니다.");
  }

  private unwrapValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
}
