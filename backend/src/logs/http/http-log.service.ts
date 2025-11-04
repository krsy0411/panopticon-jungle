import { Injectable } from "@nestjs/common";
import type { CreateHttpLogDto } from "../dto/create-http-log.dto";
import type { HttpLogDocument } from "./http-log.repository";
import { HttpLogRepository } from "./http-log.repository";
import type { LogSearchResult } from "../base-log.repository";
import { ListHttpLogsQueryDto } from "../dto/list-http-logs-query.dto";

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

  private static toInteger(value: unknown): number | null {
    if (value == null) {
      return null;
    }
    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private static toFloat(value: unknown): number | null {
    if (value == null) {
      return null;
    }
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? null : parsed;
  }
}
