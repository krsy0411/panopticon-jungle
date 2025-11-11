import { Injectable } from "@nestjs/common";
import type { ApmSearchResult } from "../../shared/apm/common/base-apm.repository";
import { SpanRepository } from "../../shared/apm/spans/span.repository";
import type { SpanDocument } from "../../shared/apm/spans/span.document";
import type { SpanItemDto } from "../common/apm-response.types";
import { resolveTimeRange } from "../common/time-range.util";
import type { SpanSearchQueryDto } from "./dto/span-search-query.dto";
import type { SpanSearchResponseDto } from "./span-search.types";

/**
 * 스팬 검색 전용 도메인 서비스
 */
@Injectable()
export class SpanSearchService {
  constructor(private readonly spanRepository: SpanRepository) {}

  async search(query: SpanSearchQueryDto): Promise<SpanSearchResponseDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 50;
    const sort = this.resolveSort(query.sort);
    const { from, to } = resolveTimeRange(query.from, query.to, 15);

    const result = await this.spanRepository.searchSpans({
      serviceName: query.service_name,
      environment: query.environment,
      name: query.name,
      kind: query.kind,
      status: query.status,
      minDurationMs: query.min_duration_ms,
      maxDurationMs: query.max_duration_ms,
      traceId: query.trace_id,
      parentSpanId: query.parent_span_id,
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
      items: result.hits.map((hit) => this.toSpanItem(hit)),
    };
  }

  private resolveSort(
    sort: SpanSearchQueryDto["sort"],
  ): Array<Record<string, { order: "asc" | "desc" }>> {
    switch (sort) {
      case "duration_asc":
        return [{ duration_ms: { order: "asc" } }];
      case "duration_desc":
        return [{ duration_ms: { order: "desc" } }];
      case "start_time_asc":
        return [{ "@timestamp": { order: "asc" } }];
      case "start_time_desc":
      default:
        return [{ "@timestamp": { order: "desc" } }];
    }
  }

  private toSpanItem(
    document: ApmSearchResult<SpanDocument>,
  ): SpanItemDto {
    return {
      timestamp: document["@timestamp"],
      span_id: document.span_id,
      parent_span_id: document.parent_span_id,
      name: document.name,
      kind: document.kind,
      duration_ms: document.duration_ms,
      status: document.status,
      service_name: document.service_name,
      environment: document.environment,
      trace_id: document.trace_id,
      labels: document.labels,
      http_method: document.http_method,
      http_path: document.http_path,
      http_status_code: document.http_status_code,
    };
  }
}
