import { Injectable } from "@nestjs/common";
import type { ApmSearchResult } from "../../../shared/apm/common/base-apm.repository";
import { SpanRepository } from "../../../shared/apm/spans/span.repository";
import type { SpanDocument } from "../../../shared/apm/spans/span.document";
import { resolveTimeRange } from "../../common/time-range.util";
import type { ServiceTraceQueryDto } from "./dto/service-trace-query.dto";
import type {
  TraceSearchResponseDto,
  TraceSummaryDto,
} from "./service-trace.types";

/**
 * 서비스별 루트 트레이스 검색 서비스
 */
@Injectable()
export class ServiceTraceService {
  constructor(private readonly spanRepository: SpanRepository) {}

  async search(
    serviceName: string,
    query: ServiceTraceQueryDto,
  ): Promise<TraceSearchResponseDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const sort = this.resolveSort(query.sort);
    const { from, to } = resolveTimeRange(query.from, query.to, 60);

    const result = await this.spanRepository.searchServiceTraces({
      serviceName,
      environment: query.environment,
      status: query.status,
      minDurationMs: query.min_duration_ms,
      maxDurationMs: query.max_duration_ms,
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
      traces: result.hits.map((hit) => this.toTraceSummary(hit)),
    };
  }

  private resolveSort(
    sort: ServiceTraceQueryDto["sort"],
  ): Array<Record<string, { order: "asc" | "desc" }>> {
    switch (sort) {
      case "duration_asc":
        return [{ duration_ms: { order: "asc" } }];
      case "start_time_asc":
        return [{ "@timestamp": { order: "asc" } }];
      case "start_time_desc":
        return [{ "@timestamp": { order: "desc" } }];
      case "duration_desc":
      default:
        return [{ duration_ms: { order: "desc" } }];
    }
  }

  private toTraceSummary(
    document: ApmSearchResult<SpanDocument>,
  ): TraceSummaryDto {
    return {
      trace_id: document.trace_id,
      root_span_name: document.name,
      status: document.status,
      duration_ms: document.duration_ms,
      start_time: document["@timestamp"],
      service_name: document.service_name,
      environment: document.environment,
      labels: document.labels,
    };
  }
}
