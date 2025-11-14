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
  serviceName?: string;
  environment?: string;
}

export interface ServiceMetricQuery {
  serviceName: string;
  environment?: string;
  from: string;
  to: string;
  interval: string;
}

export interface ServiceMetricBucket {
  timestamp: string;
  total: number;
  errorRate: number;
  p95Latency: number;
  p90Latency: number;
  p50Latency: number;
}

export interface ServiceOverviewParams {
  from: string;
  to: string;
  environment?: string;
  limit: number;
  nameFilter?: string;
}

export interface ServiceOverviewItem {
  serviceName: string;
  environment: string;
  requestCount: number;
  latencyP95: number;
  errorRate: number;
}

export interface EndpointMetricsParams {
  serviceName: string;
  from: string;
  to: string;
  environment?: string;
  limit: number;
  nameFilter?: string;
}

export interface EndpointMetricsItem {
  endpointName: string;
  serviceName: string;
  environment: string;
  requestCount: number;
  latencyP95: number;
  errorRate: number;
}

export interface SpanListQuery {
  serviceName?: string;
  environment?: string;
  name?: string;
  kind?: string;
  status?: string;
  traceId?: string;
  parentSpanId?: string;
  from: string;
  to: string;
  page: number;
  size: number;
  sort: Array<Record<string, { order: "asc" | "desc" }>>;
  minDurationMs?: number;
  maxDurationMs?: number;
}

export interface SpanSearchResult<T extends SpanDocument = SpanDocument> {
  total: number;
  hits: Array<ApmSearchResult<T>>;
}

export interface ServiceTraceSearchParams {
  serviceName: string;
  environment?: string;
  status?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  from: string;
  to: string;
  page: number;
  size: number;
  sort: Array<Record<string, { order: "asc" | "desc" }>>;
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

  private normalizeEnvironmentFilter(environment?: string): string | undefined {
    if (!environment) {
      return undefined;
    }
    const trimmed = environment.trim();
    if (!trimmed) {
      return undefined;
    }

    const key = trimmed.toLowerCase();
    const alias: Record<string, string> = {
      prod: "production",
      production: "production",
      dev: "development",
      development: "development",
      stage: "staging",
      staging: "staging",
      qa: "qa",
      test: "test",
    };

    return alias[key] ?? trimmed;
  }

  private buildTimeRangeFilter(from: string, to: string) {
    return {
      range: {
        "@timestamp": {
          gte: from,
          lte: to,
        },
      },
    };
  }

  private buildDurationRangeFilter(
    min?: number,
    max?: number,
  ): Record<string, unknown> | null {
    if (min == null && max == null) {
      return null;
    }

    return {
      range: {
        duration_ms: {
          ...(min != null ? { gte: min } : {}),
          ...(max != null ? { lte: max } : {}),
        },
      },
    };
  }

  async findByTraceId(
    params: SpanSearchParams,
  ): Promise<Array<ApmSearchResult<SpanDocument>>> {
    const size = params.size ?? 500;
    const filter: Array<Record<string, unknown>> = [
      { term: { trace_id: params.traceId } },
    ];

    if (params.serviceName) {
      filter.push({ term: { service_name: params.serviceName } });
    }
    const normalizedEnv = this.normalizeEnvironmentFilter(params.environment);
    if (normalizedEnv) {
      filter.push({ term: { environment: normalizedEnv } });
    }

    const response = await this.client.search<SpanDocument>({
      index: this.dataStream,
      size,
      sort: [{ "@timestamp": { order: "asc" as const } }],
      query: {
        bool: {
          filter,
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
    const environmentFilter = this.normalizeEnvironmentFilter(
      params.environment,
    );
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
            ...(environmentFilter
              ? [{ term: { environment: environmentFilter } }]
              : []),
          ],
        },
      },
      aggs: {
        per_interval: {
          date_histogram: {
            field: "@timestamp",
            fixed_interval: params.interval,
            time_zone: "UTC",
            min_doc_count: 0,
          },
          aggs: {
            total_requests: { value_count: { field: "span_id" } },
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
                percents: [50, 90, 95],
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
      const latencyP90 =
        bucket.latency.values["90.0"] ?? bucket.latency.values["90"] ?? NaN;
      const latencyP50 =
        bucket.latency.values["50.0"] ?? bucket.latency.values["50"] ?? NaN;

      return {
        timestamp: bucket.key_as_string,
        total,
        errorRate: total > 0 ? errors / total : 0,
        p95Latency: Number.isFinite(latencyValue) ? latencyValue : 0,
        p90Latency: Number.isFinite(latencyP90) ? latencyP90 : 0,
        p50Latency: Number.isFinite(latencyP50) ? latencyP50 : 0,
      };
    });
  }

  /**
   * 서비스 개요(요청수/지연/에러율) 집계
   */
  async aggregateServiceOverview(
    params: ServiceOverviewParams,
  ): Promise<ServiceOverviewItem[]> {
    const environmentFilter = this.normalizeEnvironmentFilter(
      params.environment,
    );
    const response = await this.client.search({
      index: this.dataStream,
      size: 0,
      query: {
        bool: {
          filter: [
            this.buildTimeRangeFilter(params.from, params.to),
            ...(environmentFilter
              ? [{ term: { environment: environmentFilter } }]
              : []),
          ],
        },
      },
      aggs: {
        services: {
          terms: {
            field: "service_name",
            size: params.limit,
          },
          aggs: {
            envs: {
              terms: {
                field: "environment",
                size: 5,
              },
              aggs: {
                latency: {
                  percentiles: {
                    field: "duration_ms",
                    percents: [50, 90, 95],
                  },
                },
                error_requests: {
                  filter: {
                    term: { status: "ERROR" },
                  },
                },
              },
            },
          },
        },
      },
    });

    const buckets =
      (
        response.aggregations as {
          services?: {
            buckets: Array<{
              key: string;
              doc_count: number;
              envs: {
                buckets: Array<{
                  key: string;
                  doc_count: number;
                  latency: { values: Record<string, number> };
                  error_requests: { doc_count: number };
                }>;
              };
            }>;
          };
        }
      )?.services?.buckets ?? [];

    const items: ServiceOverviewItem[] = [];

    for (const serviceBucket of buckets) {
      for (const envBucket of serviceBucket.envs.buckets) {
        const total = envBucket.doc_count;
        const errors = envBucket.error_requests.doc_count ?? 0;
        const latencyValue =
          envBucket.latency.values["95.0"] ??
          envBucket.latency.values["95"] ??
          NaN;

        items.push({
          serviceName: serviceBucket.key,
          environment: envBucket.key,
          requestCount: total,
          latencyP95: Number.isFinite(latencyValue) ? latencyValue : 0,
          errorRate: total > 0 ? errors / total : 0,
        });
      }
    }

    if (params.nameFilter) {
      const keyword = params.nameFilter.toLowerCase();
      return items.filter((item) =>
        item.serviceName.toLowerCase().includes(keyword),
      );
    }

    return items;
  }

  /**
   * 서비스 내 endpoint(스팬 이름) 단위 메트릭 집계
   */
  async aggregateEndpointMetrics(
    params: EndpointMetricsParams,
  ): Promise<EndpointMetricsItem[]> {
    const environmentFilter = this.normalizeEnvironmentFilter(
      params.environment,
    );
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
            this.buildTimeRangeFilter(params.from, params.to),
            ...(environmentFilter
              ? [{ term: { environment: environmentFilter } }]
              : []),
          ],
        },
      },
      aggs: {
        endpoints: {
          terms: {
            field: "name",
            size: params.limit,
          },
          aggs: {
            latency: {
              percentiles: {
                field: "duration_ms",
                percents: [50, 90, 95],
              },
            },
            error_requests: {
              filter: {
                term: { status: "ERROR" },
              },
            },
          },
        },
      },
    });

    const buckets =
      (
        response.aggregations as {
          endpoints?: {
            buckets: Array<{
              key: string;
              doc_count: number;
              latency: { values: Record<string, number> };
              error_requests: { doc_count: number };
            }>;
          };
        }
      )?.endpoints?.buckets ?? [];

    const items = buckets.map((bucket) => {
      const total = bucket.doc_count;
      const errors = bucket.error_requests.doc_count ?? 0;
      const latencyValue =
        bucket.latency.values["95.0"] ?? bucket.latency.values["95"] ?? NaN;

      return {
        endpointName: bucket.key,
        serviceName: params.serviceName,
        environment: environmentFilter ?? "all",
        requestCount: total,
        latencyP95: Number.isFinite(latencyValue) ? latencyValue : 0,
        errorRate: total > 0 ? errors / total : 0,
      };
    });

    if (params.nameFilter) {
      const keyword = params.nameFilter.toLowerCase();
      return items.filter((item) =>
        item.endpointName.toLowerCase().includes(keyword),
      );
    }

    return items;
  }

  /**
   * 범용 스팬 검색
   */
  async searchSpans(
    params: SpanListQuery,
  ): Promise<SpanSearchResult<SpanDocument>> {
    const from = (params.page - 1) * params.size;
    const normalizedEnv = this.normalizeEnvironmentFilter(params.environment);
    const filters: Array<Record<string, unknown>> = [
      this.buildTimeRangeFilter(params.from, params.to),
      ...(normalizedEnv ? [{ term: { environment: normalizedEnv } }] : []),
      ...(params.serviceName
        ? [{ term: { service_name: params.serviceName } }]
        : []),
      ...(params.name ? [{ term: { name: params.name } }] : []),
      ...(params.kind ? [{ term: { kind: params.kind } }] : []),
      ...(params.status ? [{ term: { status: params.status } }] : []),
      ...(params.traceId ? [{ term: { trace_id: params.traceId } }] : []),
      ...(params.parentSpanId
        ? [{ term: { parent_span_id: params.parentSpanId } }]
        : []),
    ];

    const durationFilter = this.buildDurationRangeFilter(
      params.minDurationMs,
      params.maxDurationMs,
    );
    if (durationFilter) {
      filters.push(durationFilter);
    }

    const response = await this.client.search<SpanDocument>({
      index: this.dataStream,
      from,
      size: params.size,
      sort: params.sort,
      track_total_hits: true,
      query: {
        bool: {
          filter: filters,
        },
      },
    });

    const hits = response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: SpanDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return {
      total,
      hits,
    };
  }

  /**
   * 서비스별 루트 스팬(트레이스 요약) 검색
   */
  async searchServiceTraces(
    params: ServiceTraceSearchParams,
  ): Promise<SpanSearchResult<SpanDocument>> {
    const from = (params.page - 1) * params.size;
    const normalizedEnv = this.normalizeEnvironmentFilter(params.environment);
    const filters: Array<Record<string, unknown>> = [
      { term: { service_name: params.serviceName } },
      { term: { kind: "SERVER" } },
      this.buildTimeRangeFilter(params.from, params.to),
      { bool: { must_not: [{ exists: { field: "parent_span_id" } }] } },
    ];

    if (normalizedEnv) {
      filters.push({ term: { environment: normalizedEnv } });
    }
    if (params.status) {
      filters.push({ term: { status: params.status } });
    }
    if (params.minDurationMs != null || params.maxDurationMs != null) {
      filters.push({
        range: {
          duration_ms: {
            ...(params.minDurationMs != null
              ? { gte: params.minDurationMs }
              : {}),
            ...(params.maxDurationMs != null
              ? { lte: params.maxDurationMs }
              : {}),
          },
        },
      });
    }

    const response = await this.client.search<SpanDocument>({
      index: this.dataStream,
      from,
      size: params.size,
      sort: params.sort,
      track_total_hits: true,
      query: {
        bool: {
          filter: filters,
        },
      },
    });

    const hits = response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: SpanDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return {
      total,
      hits,
    };
  }
}
