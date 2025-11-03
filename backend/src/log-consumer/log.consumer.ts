import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import type { CreateLogDto } from "../logs/dto/create-logs.dto";
import { LogService } from "../logs/logs.service";

@Controller()
export class LogConsumer {
  private readonly logger = new Logger(LogConsumer.name);

  constructor(private readonly logService: LogService) {}

  @EventPattern(process.env.KAFKA_LOG_TOPIC ?? "app")
  async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload, skip");
      return;
    }

    try {
      const log = this.toLogDto(value);
      await this.logService.ingest(log, {
        remoteAddress: null,
        userAgent: null,
      });
      this.logger.log(
        `Log message ingested (topic=${context.getTopic()}, partition=${context.getPartition()})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process Kafka log message",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private toLogDto(payload: unknown): CreateLogDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateLogDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateLogDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateLogDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateLogDto;
    }

    throw new Error("Unsupported Kafka payload type");
  }

  private unwrapValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
}
