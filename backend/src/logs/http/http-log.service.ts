import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreateHttpLogDto } from "../dto/create-http-log.dto";
import type { HttpLogDocument, HttpStatusCodeCountBucket } from "./http-log.repository";
import { HttpLogRepository } from "./http-log.repository";
import type { LogSearchResult } from "../base-log.repository";
import { ListHttpLogsQueryDto } from "../dto/list-http-logs-query.dto";
import { HttpStatusCodeCountsQueryDto } from "../dto/http-status-code-counts-query.dto";

export interface HttpStatusCodeCountsResponse {
  interval: string;
  buckets: HttpStatusCodeCountBucket[];
}

@Injectable()
export class HttpLogService {
  constructor(private readonly repository: HttpLogRepository) {}

  async ingest(dto: CreateHttpLogDto): Promise<void> {
    const timestamp =
      dto.timestamp && !Number.isNaN(Date.parse(dto.timestamp))
        ? new Date(dto.timestamp).toISOString()
        : new Date().toISOString();

    const document: HttpLogDocument = {
      "@timestamp": timestamp,
      request_id: dto.request_id ?? null,
      client_ip: dto.client_ip ?? null,
      method: dto.method ? dto.method.toUpperCase() : null,
      path: dto.path ?? null,
      status_code: HttpLogService.toInteger(dto.status_code),
      request_time: HttpLogService.toFloat(dto.request_time),
      user_agent: dto.user_agent ?? null,
      upstream_service: dto.upstream_service ?? null,
      upstream_status: HttpLogService.toInteger(dto.upstream_status),
      upstream_response_time: HttpLogService.toFloat(
        dto.upstream_response_time,
      ),
      ingestedAt: new Date().toISOString(),
    };

    await this.repository.save(document);
  }

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
      ? HttpLogService.parseDateOrThrow(query.end, "end")
      : new Date();
    const start = query.start
      ? HttpLogService.parseDateOrThrow(query.start, "start")
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

  private static toInteger(value: unknown): number | null {
    if (value == null) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isNaN(value) ? null : value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private static toFloat(value: unknown): number | null {
    if (value == null) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isNaN(value) ? null : value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private static parseDateOrThrow(value: string, label: string): Date {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${label} timestamp`);
    }

    return parsed;
  }
}
