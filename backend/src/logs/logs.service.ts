import { Injectable } from "@nestjs/common";
import type { CreateLogDto } from "./dto/create-logs.dto";
import type { ListLogsQueryDto } from "./dto/list-logs-query.dto";
import {
  type LogDocument,
  LogRepository,
  type LogSearchResult,
} from "./logs.repository";

export interface LogIngestContext {
  remoteAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LogService {
  constructor(private readonly repository: LogRepository) {}

  async ingest(
    dto: CreateLogDto,
    context: LogIngestContext = {},
  ): Promise<void> {
    const timestamp =
      dto.timestamp && !Number.isNaN(Date.parse(dto.timestamp))
        ? new Date(dto.timestamp).toISOString()
        : new Date().toISOString();

    const document: LogDocument = {
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

  async listLogs(query: ListLogsQueryDto): Promise<LogSearchResult[]> {
    return this.repository.search({
      service: query.service,
      level: query.level,
      limit: query.limit,
    });
  }
}
