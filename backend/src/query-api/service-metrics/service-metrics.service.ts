import { Injectable, Logger } from "@nestjs/common";
import { SpanRepository } from "../../shared/apm/spans/span.repository";
import type { ServiceMetricBucket } from "../../shared/apm/spans/span.repository";
import type {
  MetricResponse,
  AggregationProfiler,
} from "./service-metric.types";
import type { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";
import { MetricsQueryNormalizerService } from "./metrics-query-normalizer.service";
import type { NormalizedServiceMetricsQuery } from "./normalized-service-metrics-query.type";
import { MetricsCacheService } from "./metrics-cache.service";

/**
 * 시계열 집계를 위한 내부 파라미터
 * - from/to: 조회 구간
 * - interval: date_histogram 에 전달할 간격 표현식(예: 1m, 5m)
 */
@Injectable()
export class ServiceMetricsService {
  private readonly logger = new Logger(ServiceMetricsService.name);
  private readonly profilingEnabled =
    (process.env.SERVICE_METRICS_PROFILE ?? "false").toLowerCase() === "true";

  constructor(
    private readonly spanRepository: SpanRepository,
    private readonly queryNormalizer: MetricsQueryNormalizerService,
    private readonly metricsCache: MetricsCacheService,
  ) {}

  async getMetrics(
    serviceName: string,
    query: ServiceMetricsQueryDto,
  ): Promise<MetricResponse[]> {
    // 1) 쿼리를 10초 시간 버킷으로 정규화하고 캐시 여부를 판별한다.
    const normalized = this.queryNormalizer.normalize(serviceName, query);
    const cacheEnabled =
      normalized.shouldUseCache && this.metricsCache.isEnabled();
    let cacheKey: string | null = null;
    const profiler = this.createProfiler(normalized);

    if (cacheEnabled) {
      // 캐시가 활성화된 경우 먼저 Redis에서 결과를 조회한다.
      cacheKey = this.metricsCache.buildKey(normalized);
      const cached = await this.metricsCache.get(cacheKey);
      if (cached) {
        this.logger.debug(
          `서비스 메트릭 캐시 히트 service=${normalized.serviceName} env=${normalized.environment ?? "all"} from=${normalized.from} to=${normalized.to} interval=${normalized.interval}`,
        );
        return JSON.parse(cached) as MetricResponse[];
      }
      this.logger.debug(
        `서비스 메트릭 캐시 미스 service=${normalized.serviceName} env=${normalized.environment ?? "all"} from=${normalized.from} to=${normalized.to} interval=${normalized.interval}`,
      );
    }

    profiler?.mark("es_query");

    const params = this.toMetricParams(normalized);
    const buckets = await this.spanRepository.aggregateServiceMetrics(params);
    const metrics = this.toMetricResponses(
      normalized.serviceName,
      normalized.environment,
      buckets,
    );

    const filteredMetrics = normalized.metric
      ? metrics.filter((item) => item.metric_name === normalized.metric)
      : metrics;

    profiler?.mark("response_ready");
    profiler?.logSummary(filteredMetrics.length);

    if (cacheEnabled && cacheKey) {
      // ES에서 구한 결과를 짧은 TTL로 Redis에 적재한다.
      await this.metricsCache.set(cacheKey, JSON.stringify(filteredMetrics));
    }

    return filteredMetrics;
  }

  /**
   * 캐시 로직과 ES 검색 파라미터 변환을 분리해 SOLID 원칙을 지킨다.
   */
  private toMetricParams(normalized: NormalizedServiceMetricsQuery): {
    serviceName: string;
    environment?: string;
    from: string;
    to: string;
    interval: string;
  } {
    return {
      serviceName: normalized.serviceName,
      environment: normalized.environment,
      from: normalized.from,
      to: normalized.to,
      interval: normalized.interval,
    };
  }

  private toMetricResponses(
    serviceName: string,
    environment: string | undefined,
    buckets: ServiceMetricBucket[],
  ): MetricResponse[] {
    const qpsPoints = buckets.map((bucket) => ({
      timestamp: bucket.timestamp,
      value: bucket.total,
      labels: this.baseLabels(environment),
    }));

    const latencyP95Points = buckets.map((bucket) => ({
      timestamp: bucket.timestamp,
      value: bucket.p95Latency,
      labels: this.baseLabels(environment),
    }));

    const latencyP90Points = buckets.map((bucket) => ({
      timestamp: bucket.timestamp,
      value: bucket.p90Latency,
      labels: this.baseLabels(environment),
    }));

    const latencyP50Points = buckets.map((bucket) => ({
      timestamp: bucket.timestamp,
      value: bucket.p50Latency,
      labels: this.baseLabels(environment),
    }));

    const errorRatePoints = buckets.map((bucket) => ({
      timestamp: bucket.timestamp,
      value: Number(bucket.errorRate.toFixed(4)),
      labels: this.baseLabels(environment),
    }));

    return [
      {
        metric_name: "http_requests_total",
        service_name: serviceName,
        environment: environment ?? "all",
        points: qpsPoints,
      },
      {
        metric_name: "latency_p95_ms",
        service_name: serviceName,
        environment: environment ?? "all",
        points: latencyP95Points,
      },
      {
        metric_name: "latency_p90_ms",
        service_name: serviceName,
        environment: environment ?? "all",
        points: latencyP90Points,
      },
      {
        metric_name: "latency_p50_ms",
        service_name: serviceName,
        environment: environment ?? "all",
        points: latencyP50Points,
      },
      {
        metric_name: "error_rate",
        service_name: serviceName,
        environment: environment ?? "all",
        points: errorRatePoints,
      },
    ];
  }

  private baseLabels(environment?: string): Record<string, string> | undefined {
    return environment ? { environment } : undefined;
  }

  private createProfiler(
    normalized: NormalizedServiceMetricsQuery,
  ): AggregationProfiler | null {
    if (!this.profilingEnabled) {
      return null;
    }
    const startedAt = Date.now();
    return {
      mark: (event) => {
        const elapsed = Date.now() - startedAt;
        const label =
          event === "es_query" ? "ES 집계 완료" : "응답 데이터 정리";
        this.logger.debug(
          `메트릭 성능(${label}) service=${normalized.serviceName} env=${normalized.environment ?? "all"} from=${normalized.from} to=${normalized.to} elapsed=${elapsed}ms`,
        );
      },
      logSummary: (responseLength) => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(
          `메트릭 총 소요 service=${normalized.serviceName} env=${normalized.environment ?? "all"} window=${normalized.from}~${normalized.to} metrics=${responseLength}건 elapsed=${elapsed}ms`,
        );
      },
    };
  }
}
