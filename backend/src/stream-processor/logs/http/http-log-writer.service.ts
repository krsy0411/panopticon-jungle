import { Injectable } from "@nestjs/common";
import type { CreateHttpLogDto } from "../../../shared/logs/dto/create-http-log.dto";
import type { HttpLogDocument } from "../../../shared/logs/http/http-log.repository";
import { HttpLogRepository } from "../../../shared/logs/http/http-log.repository";

@Injectable()
export class HttpLogWriterService {
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
      status_code: HttpLogWriterService.toInteger(dto.status_code),
      request_time: HttpLogWriterService.toFloat(dto.request_time),
      user_agent: dto.user_agent ?? null,
      upstream_service: dto.upstream_service ?? null,
      upstream_status: HttpLogWriterService.toInteger(dto.upstream_status),
      upstream_response_time: HttpLogWriterService.toFloat(
        dto.upstream_response_time,
      ),
      ingestedAt: new Date().toISOString(),
    };

    await this.repository.save(document);
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
}
