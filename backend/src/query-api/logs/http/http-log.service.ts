import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  HttpLogDocument,
  HttpStatusCodeCountBucket,
} from "../../../shared/logs/http/http-log.repository";
import { HttpLogRepository } from "../../../shared/logs/http/http-log.repository";
import type { LogSearchResult } from "../../../shared/logs/base-log.repository";
import { ListHttpLogsQueryDto } from "../../../shared/logs/dto/list-http-logs-query.dto";
import { HttpStatusCodeCountsQueryDto } from "../../../shared/logs/dto/http-status-code-counts-query.dto";

export interface HttpStatusCodeCountsResponse {
  interval: string;
  buckets: HttpStatusCodeCountBucket[];
}

@Injectable()
export class HttpLogQueryService {
  constructor(private readonly repository: HttpLogRepository) {}

  async listLogs(
    query: ListHttpLogsQueryDto,
  ): Promise<Array<LogSearchResult<HttpLogDocument>>> {
    return this.repository.search({
      method: query.method,
      path: query.path,
      statusCode: query.statusCode,
      limit: query.limit,
    });
  }

  async getStatusCodeCounts(
    query: HttpStatusCodeCountsQueryDto,
  ): Promise<HttpStatusCodeCountsResponse> {
    const end = query.end
      ? HttpLogQueryService.parseDateOrThrow(query.end, "end")
      : new Date();
    const start = query.start
      ? HttpLogQueryService.parseDateOrThrow(query.start, "start")
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    if (start.getTime() >= end.getTime()) {
      throw new BadRequestException("start must be earlier than end");
    }

    const interval = query.interval ?? "1h";

    const buckets = await this.repository.aggregateStatusCodeCounts({
      start: start.toISOString(),
      end: end.toISOString(),
      interval,
    });

    return {
      interval,
      buckets,
    };
  }

  private static parseDateOrThrow(value: string, label: string): Date {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${label} timestamp`);
    }

    return parsed;
  }
}
