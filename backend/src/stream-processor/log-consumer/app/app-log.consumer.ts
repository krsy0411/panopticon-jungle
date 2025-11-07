import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import type { CreateAppLogDto } from "../../../shared/logs/dto/create-app-log.dto";
import { AppLogWriterService } from "../../logs/app/app-log-writer.service";

@Controller()
export class AppLogConsumer {
  private readonly logger = new Logger(AppLogConsumer.name);

  constructor(private readonly logService: AppLogWriterService) {}

  @EventPattern(process.env.KAFKA_APP_LOG_TOPIC ?? "logs.app")
  async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka message without payload, skip");
      return;
    }

    try {
      const log = this.parseAppLog(value);
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

  private parseAppLog(payload: unknown): CreateAppLogDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateAppLogDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateAppLogDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateAppLogDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateAppLogDto;
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
