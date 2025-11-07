import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, KafkaContext } from "@nestjs/microservices";
import type { CreateHttpLogDto } from "../../../shared/logs/dto/create-http-log.dto";
import { HttpLogWriterService } from "../../logs/http/http-log-writer.service";

@Controller()
export class HttpLogConsumer {
  private readonly logger = new Logger(HttpLogConsumer.name);

  constructor(private readonly logService: HttpLogWriterService) {}

  @EventPattern(process.env.KAFKA_HTTP_LOG_TOPIC ?? "logs.http")
  async handleHttpLog(@Ctx() context: KafkaContext): Promise<void> {
    const value = context.getMessage().value;
    if (value == null) {
      this.logger.warn("Kafka HTTP log without payload, skip");
      return;
    }

    try {
      const log = this.parseHttpLog(value);
      await this.logService.ingest(log);
      this.logger.log(
        `HTTP log ingested (topic=${context.getTopic()}, partition=${context.getPartition()})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to process Kafka HTTP log",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private parseHttpLog(payload: unknown): CreateHttpLogDto {
    const resolved = this.unwrapValue(payload);

    if (typeof resolved === "string") {
      return JSON.parse(resolved) as CreateHttpLogDto;
    }

    if (resolved instanceof Buffer) {
      return JSON.parse(resolved.toString()) as CreateHttpLogDto;
    }

    if (ArrayBuffer.isView(resolved)) {
      return JSON.parse(
        Buffer.from(resolved.buffer).toString(),
      ) as CreateHttpLogDto;
    }

    if (resolved && typeof resolved === "object") {
      return resolved as CreateHttpLogDto;
    }

    throw new Error("Unsupported Kafka HTTP payload type");
  }

  private unwrapValue(value: unknown): unknown {
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
}
