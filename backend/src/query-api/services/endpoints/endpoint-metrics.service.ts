import { Injectable } from "@nestjs/common";
import { SpanRepository } from "../../../shared/apm/spans/span.repository";
import { resolveTimeRange } from "../../common/time-range.util";
import type { EndpointMetricsQueryDto } from "./dto/endpoint-metrics-query.dto";
import type {
  EndpointMetricsItemDto,
  EndpointMetricsResponseDto,
} from "./endpoint-metrics.types";

/**
 * 서비스 엔드포인트 단위 메트릭 집계 서비스
 */
@Injectable()
export class EndpointMetricsService {
  constructor(private readonly spanRepository: SpanRepository) {}

  async getEndpointMetrics(
    serviceName: string,
    query: EndpointMetricsQueryDto,
  ): Promise<EndpointMetricsResponseDto> {
    const { from, to } = resolveTimeRange(query.from, query.to, 60);
    const limit = query.limit ?? 10;
    const sortBy = query.sort_by ?? query.metric ?? "request_count";

    const items = await this.spanRepository.aggregateEndpointMetrics({
      serviceName,
      environment: query.environment,
      from,
      to,
      limit,
      nameFilter: query.name_filter,
    });

    const normalized = items.map<EndpointMetricsItemDto>((item) => ({
      endpoint_name: item.endpointName,
      service_name: item.serviceName,
      environment: item.environment,
      request_count: item.requestCount,
      latency_p95_ms: item.latencyP95,
      error_rate: Number(item.errorRate.toFixed(4)),
    }));

    const sorted = this.sortEndpoints(normalized, sortBy);

    return {
      service_name: serviceName,
      environment: query.environment ?? null,
      from,
      to,
      endpoints: sorted.slice(0, limit),
    };
  }

  private sortEndpoints(
    items: EndpointMetricsItemDto[],
    sortBy: "request_count" | "latency_p95_ms" | "error_rate",
  ): EndpointMetricsItemDto[] {
    return [...items].sort(
      (a, b) => (b[sortBy] as number) - (a[sortBy] as number),
    );
  }
}
