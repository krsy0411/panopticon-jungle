import { Injectable } from "@nestjs/common";
import type { CreateAppLogDto } from "../dto/create-app-log.dto";
import type { ListAppLogsQueryDto } from "../dto/list-app-logs-query.dto";
import type { AppLogDocument } from "./app-log.repository";
import { AppLogRepository } from "./app-log.repository";
import type { LogSearchResult } from "../base-log.repository";

export interface AppLogIngestContext {
  remoteAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AppLogService {
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

  async listLogs(
    query: ListAppLogsQueryDto,
  ): Promise<LogSearchResult<AppLogDocument>[]> {
    return this.repository.search({
      service: query.service,
      level: query.level,
      limit: query.limit,
    });
  }
}
