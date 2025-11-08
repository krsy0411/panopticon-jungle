import { Injectable } from "@nestjs/common";
import type { CreateAppLogDto } from "../../../shared/logs/dto/create-app-log.dto";
import type { AppLogDocument } from "../../../shared/logs/app/app-log.repository";
import { AppLogRepository } from "../../../shared/logs/app/app-log.repository";

export interface AppLogIngestContext {
  remoteAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AppLogWriterService {
  constructor(private readonly repository: AppLogRepository) {}

  async ingest(
    dto: CreateAppLogDto,
    context: AppLogIngestContext = {},
  ): Promise<void> {
    const timestamp =
      dto.timestamp && !Number.isNaN(Date.parse(dto.timestamp))
        ? new Date(dto.timestamp).toISOString()
        : new Date().toISOString();

    const document: AppLogDocument = {
      "@timestamp": timestamp,
      service: dto.service,
      level: dto.level,
      message: dto.message,
      remoteAddress: context.remoteAddress ?? null,
      userAgent: context.userAgent ?? null,
      ingestedAt: new Date().toISOString(),
    };

    await this.repository.save(document);
  }
}
