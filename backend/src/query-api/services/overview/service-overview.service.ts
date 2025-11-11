import { Injectable } from "@nestjs/common";
import { SpanRepository } from "../../../shared/apm/spans/span.repository";
import { resolveTimeRange } from "../../common/time-range.util";
import { ServiceOverviewQueryDto } from "./dto/service-overview-query.dto";
import {
  ServiceOverviewResponseDto,
  ServiceSummaryDto,
} from "./service-overview.types";

/**
 * 서비스별 집계 데이터를 조회하는 도메인 서비스
 */
@Injectable()
export class ServiceOverviewService {
  constructor(private readonly spanRepository: SpanRepository) {}

  async getOverview(
    query: ServiceOverviewQueryDto,
  ): Promise<ServiceOverviewResponseDto> {
    const { from, to } = resolveTimeRange(query.from, query.to, 60);

    const summaries = await this.spanRepository.aggregateServiceOverview({
      from,
      to,
      environment: query.environment,
      limit: query.limit ?? 50,
      nameFilter: query.name_filter,
    });

    const mapped: ServiceSummaryDto[] = summaries.map((item) => ({
      service_name: item.serviceName,
      environment: item.environment,
      request_count: item.requestCount,
      latency_p95_ms: item.latencyP95,
      error_rate: Number(item.errorRate.toFixed(4)),
    }));

    const sorted = this.sortSummaries(mapped, query.sort_by);

    return {
      from,
      to,
      environment: query.environment ?? null,
      services: sorted,
    };
  }

  /**
   * 정렬 기준에 따라 서비스 요약을 정렬한다.
   */
  private sortSummaries(
    items: ServiceSummaryDto[],
    sortBy: "request_count" | "latency_p95_ms" | "error_rate" = "request_count",
  ): ServiceSummaryDto[] {
    return [...items].sort((a, b) => {
      const key = sortBy;
      return (b[key] as number) - (a[key] as number);
    });
  }
}
