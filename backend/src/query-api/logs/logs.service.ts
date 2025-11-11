import { Injectable } from "@nestjs/common";
import type { ApmSearchResult } from "../../shared/apm/common/base-apm.repository";
import { ApmLogRepository } from "../../shared/apm/logs/log.repository";
import type { LogDocument } from "../../shared/apm/logs/log.document";
import type { LogItemDto } from "../common/apm-response.types";
import { resolveTimeRange } from "../common/time-range.util";
import type { LogSearchQueryDto } from "./dto/log-search-query.dto";
import type { LogSearchResponseDto } from "./logs.types";

/**
 * Elasticsearch 로그 데이터를 검색하는 도메인 서비스
 */
@Injectable()
export class LogSearchService {
  constructor(private readonly logRepository: ApmLogRepository) {}

  async search(query: LogSearchQueryDto): Promise<LogSearchResponseDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 50;
    const sort = query.sort ?? "desc";
    const { from, to } = resolveTimeRange(query.from, query.to, 15);

    const result = await this.logRepository.searchLogs({
      serviceName: query.service_name,
      environment: query.environment,
      level: query.level,
      traceId: query.trace_id,
      spanId: query.span_id,
      message: query.message,
      from,
      to,
      page,
      size,
      sort,
    });

    return {
      total: result.total,
      page,
      size,
      items: result.hits.map((hit) => this.toLogItem(hit)),
    };
  }

  private toLogItem(
    document: ApmSearchResult<LogDocument>,
  ): LogItemDto {
    return {
      timestamp: document["@timestamp"],
      level: document.level,
      message: document.message,
      service_name: document.service_name,
      environment: document.environment,
      trace_id: document.trace_id,
      span_id: document.span_id,
      labels: document.labels,
    };
  }
}
