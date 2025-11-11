import { Injectable } from "@nestjs/common";
import {
  ApmSearchResult,
  BaseApmRepository,
} from "../common/base-apm.repository";
import type { SpanDocument } from "./span.document";
import { LogStorageService } from "../../logs/log-storage.service";

export interface SpanSearchParams {
  traceId: string;
  size?: number;
}

export interface ServiceMetricQuery {
  serviceName: string;
  environment?: string;
  from: string;
  to: string;
  intervalMinutes: number;
}

export interface ServiceMetricBucket {
  timestamp: string;
  total: number;
  errorRate: number;
  p95Latency: number;
}

/**
 * 스팬 데이터 스트림을 다루는 레포지토리
 * - trace 조회 + 파생 메트릭 집계 기능을 제공
 */
@Injectable()
export class SpanRepository extends BaseApmRepository<SpanDocument> {
  private static readonly STREAM_KEY = "apmSpans";

  constructor(storage: LogStorageService) {
    super(storage, SpanRepository.STREAM_KEY);
  }

  async findByTraceId(
    params: SpanSearchParams,
  ): Promise<Array<ApmSearchResult<SpanDocument>>> {
    const size = params.size ?? 500;
    const response = await this.client.search<SpanDocument>({
      index: this.dataStream,
      size,
      sort: [{ "@timestamp": { order: "asc" as const } }],
      query: {
        bool: {
          must: [{ term: { trace_id: params.traceId } }],
        },
      },
    });

    return response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: SpanDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));
  }

  /**
   * 서비스별 QPS/에러율/p95 지연 시간을 버킷 단위로 집계한다.
   */
  async aggregateServiceMetrics(
    params: ServiceMetricQuery,
  ): Promise<ServiceMetricBucket[]> {
    const response = await this.client.search({
      index: this.dataStream,
      size: 0,
      query: {
        bool: {
          must: [
            { term: { service_name: params.serviceName } },
            { term: { kind: "SERVER" } },
          ],
          filter: [
            {
              range: {
                "@timestamp": {
                  gte: params.from,
                  lte: params.to,
                },
              },
            },
            ...(params.environment
              ? [{ term: { environment: params.environment } }]
              : []),
          ],
        },
      },
      aggs: {
        per_interval: {
          date_histogram: {
            field: "@timestamp",
            fixed_interval: `${params.intervalMinutes}m`,
            time_zone: "UTC",
            min_doc_count: 0,
          },
          aggs: {
            total_requests: { value_count: { field: "span_id.keyword" } },
            error_requests: {
              filter: {
                term: {
                  status: "ERROR",
                },
              },
            },
            latency: {
              percentiles: {
                field: "duration_ms",
                percents: [95],
              },
            },
          },
        },
      },
    });

    const buckets =
      (
        response.aggregations as {
          per_interval?: {
            buckets: Array<{
              key_as_string: string;
              doc_count: number;
              total_requests: { value: number };
              error_requests: { doc_count: number };
              latency: { values: Record<string, number> };
            }>;
          };
        }
      )?.per_interval?.buckets ?? [];

    return buckets.map((bucket) => {
      const total = bucket.total_requests.value ?? bucket.doc_count ?? 0;
      const errors = bucket.error_requests.doc_count ?? 0;
      const latencyValue =
        bucket.latency.values["95.0"] ?? bucket.latency.values["95"] ?? NaN;

      return {
        timestamp: bucket.key_as_string,
        total,
        errorRate: total > 0 ? errors / total : 0,
        p95Latency: Number.isFinite(latencyValue) ? latencyValue : 0,
      };
    });
  }
}
