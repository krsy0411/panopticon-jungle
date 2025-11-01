import { Body, Controller, Logger, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { KafkaService } from "./kafka/kafka.service";

@Controller("logs")
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly kafkaService: KafkaService) {}

  @Post()
  async ingest(@Body() payload: unknown, @Req() req: Request) {
    await this.kafkaService.emitLog({
      payload,
      metadata: {
        sourceIp: req.ip,
        receivedAt: new Date().toISOString(),
        userAgent: req.get("user-agent") ?? "unknown",
      },
    });
    this.logger.log(`Queued log from ${req.ip}: ${JSON.stringify(payload)}`);
    return { status: "queued" };
  }
}
