import { Injectable } from "@nestjs/common";
import type { ListAppLogsQueryDto } from "../../../shared/logs/dto/list-app-logs-query.dto";
import type { AppLogDocument } from "../../../shared/logs/app/app-log.repository";
import { AppLogRepository } from "../../../shared/logs/app/app-log.repository";
import type { LogSearchResult } from "../../../shared/logs/base-log.repository";

@Injectable()
export class AppLogQueryService {
  constructor(private readonly repository: AppLogRepository) {}

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
