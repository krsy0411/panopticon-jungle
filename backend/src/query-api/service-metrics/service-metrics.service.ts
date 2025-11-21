import { Injectable, Logger } from "@nestjs/common";
import { formatInTimeZone } from "date-fns-tz";
import { SpanRepository } from "../../shared/apm/spans/span.repository";
import type { ServiceMetricBucket } from "../../shared/apm/spans/span.repository";
import { RollupMetricsReadRepository } from "../../shared/apm/rollup/rollup-metrics-read.repository";
import type { RollupMetricDocument } from "../../shared/apm/rollup/rollup-metric.document";
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
  // 롤업 전략/캐시 관련 환경 변수
  private readonly rollupEnabled =
    (process.env.ROLLUP_ENABLED ?? "true").toLowerCase() === "true";
  private readonly rollupThresholdMs =
    this.minutesToMs(Number(process.env.ROLLUP_THRESHOLD_MINUTES ?? "5")) ||
    5 * 60 * 1000;
  private readonly rollupBucketMs = Math.max(
    60 * 1000,
    this.minutesToMs(Number(process.env.ROLLUP_BUCKET_MINUTES ?? "1")),
  );
  private readonly rollupCacheTtlSeconds = Math.max(
    0,
    Number(process.env.ROLLUP_CACHE_TTL_SECONDS ?? "60"),
  );
  private readonly rollupCachePrefix =
    process.env.ROLLUP_CACHE_PREFIX ?? "apm:metrics-rollup";
  private readonly maxRollupBuckets = Math.max(
    500,
    Number(process.env.ROLLUP_MAX_QUERY_BUCKETS ?? "43200"),
  );

  constructor(
    private readonly spanRepository: SpanRepository,
    private readonly rollupRepository: RollupMetricsReadRepository,
    private readonly queryNormalizer: MetricsQueryNormalizerService,
    private readonly metricsCache: MetricsCacheService,
  ) {
    this.logger.log(
      `롤업 조회 설정: enabled=${this.rollupEnabled} thresholdMinutes=${this.rollupThresholdMs / 60000} bucketMinutes=${this.rollupBucketMs / 60000}`,
    );
  }

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
          `서비스 메트릭 캐시 히트 service=${normalized.serviceName} env=${normalized.environment ?? "all"} from=${this.formatTimestamp(normalized.from)} to=${this.formatTimestamp(normalized.to)} interval=${normalized.interval}`,
        );
        return JSON.parse(cached) as MetricResponse[];
      }
      this.logger.debug(
        `서비스 메트릭 캐시 미스 service=${normalized.serviceName} env=${normalized.environment ?? "all"} from=${this.formatTimestamp(normalized.from)} to=${this.formatTimestamp(normalized.to)} interval=${normalized.interval}`,
      );
    }
    const plan = this.buildFetchPlan(normalized);
    this.logger.debug(
      plan.rollupWindow
        ? `롤업 구간 적용 service=${normalized.serviceName} rollupWindow=${this.formatTimestamp(plan.rollupWindow.from)}~${this.formatTimestamp(plan.rollupWindow.to)} rawWindow=${plan.rawWindow ? `${this.formatTimestamp(plan.rawWindow.from)}~${this.formatTimestamp(plan.rawWindow.to)}` : "없음"}`
        : `롤업 미적용 service=${normalized.serviceName} window=${this.formatTimestamp(normalized.from)}~${this.formatTimestamp(normalized.to)}`,
    );
    const rollupBuckets = plan.rollupWindow
      ? await this.fetchRollupBuckets(normalized, plan.rollupWindow)
      : [];
    const rollupBucketCount = rollupBuckets.length;
    this.logger.debug(
      `롤업 버킷 조회 결과 service=${normalized.serviceName} buckets=${rollupBucketCount}`,
    );
    const rawBuckets = plan.rawWindow
      ? await this.fetchRawBuckets(normalized, plan.rawWindow)
      : [];
    this.logger.debug(
      `RAW 버킷 조회 결과 service=${normalized.serviceName} buckets=${rawBuckets.length}`,
    );
    const buckets = this.mergeMetricBuckets(rollupBuckets, rawBuckets);

    profiler?.mark("es_query");

    const metrics = this.toMetricResponses(
      normalized.serviceName,
      normalized.environment,
      buckets,
    );

    const filteredMetrics = normalized.metric
      ? metrics.filter((item) => item.metric_name === normalized.metric)
      : metrics;

    const totalBuckets = buckets.length;
    const totalRequests = buckets.reduce(
      (sum, bucket) => sum + bucket.total,
      0,
    );
    this.logger.log(
      `메트릭 조회 요약 service=${normalized.serviceName} env=${normalized.environment ?? "all"} window=${this.formatTimestamp(normalized.from)}~${this.formatTimestamp(normalized.to)} rollupBuckets=${rollupBucketCount} rawBuckets=${rawBuckets.length} totalBuckets=${totalBuckets} totalRequests=${totalRequests}`,
    );

    profiler?.mark("response_ready");
    profiler?.logSummary(filteredMetrics.length);

    if (cacheEnabled && cacheKey) {
      // ES에서 구한 결과를 짧은 TTL로 Redis에 적재한다.
      await this.metricsCache.set(cacheKey, JSON.stringify(filteredMetrics));
    }

    return filteredMetrics;
  }

  /**
   * raw/rollup 버킷을 공통 메트릭 응답 구조로 변환한다.
   */
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

  /**
   * 환경 레이블을 통일된 형태로 반환한다.
   */
  private baseLabels(environment?: string): Record<string, string> | undefined {
    return environment ? { environment } : undefined;
  }

  /**
   * RAW 집계 대상 구간에 대해 기존 스팬 집계 쿼리를 실행한다.
   */
  private async fetchRawBuckets(
    normalized: NormalizedServiceMetricsQuery,
    window: MetricsWindow | null,
  ): Promise<ServiceMetricBucket[]> {
    if (!window || window.from === window.to) {
      return [];
    }
    return this.spanRepository.aggregateServiceMetrics({
      serviceName: normalized.serviceName,
      environment: normalized.environment,
      from: window.from,
      to: window.to,
      interval: normalized.interval,
    });
  }

  /**
   * 롤업 데이터 스트림에서 1분 버킷을 조회하고 ServiceMetricBucket 형태로 변환한다.
   * - Redis 캐시가 켜져 있으면 window 범위 전체를 캐시에 저장한다.
   */
  private async fetchRollupBuckets(
    normalized: NormalizedServiceMetricsQuery,
    window: MetricsWindow | null,
  ): Promise<ServiceMetricBucket[]> {
    if (
      !window ||
      !this.rollupEnabled ||
      window.from === window.to ||
      this.rollupBucketMs <= 0
    ) {
      return [];
    }

    const cacheKey =
      this.rollupCacheAvailable() &&
      this.buildRollupCacheKey(normalized, window);
    if (cacheKey) {
      const cached = await this.metricsCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ServiceMetricBucket[];
      }
    }

    const fromMs = Date.parse(window.from);
    const toMs = Date.parse(window.to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
      return [];
    }

    // 롤업 문서는 1분 버킷이므로 검색 구간을 버킷 경계로 정규화한다.
    const searchFrom = this.floorToBucket(fromMs);
    const searchTo = this.floorToBucket(toMs);
    if (searchTo <= searchFrom) {
      return [];
    }

    const expectedBuckets = Math.min(
      this.maxRollupBuckets,
      Math.max(1, Math.ceil((searchTo - searchFrom) / this.rollupBucketMs) + 5),
    );
    const documents = await this.rollupRepository.search({
      serviceName: normalized.serviceName,
      environment: normalized.environment,
      from: new Date(searchFrom).toISOString(),
      to: new Date(searchTo).toISOString(),
      size: expectedBuckets,
    });
    const lowerBound = fromMs;
    const upperBound = toMs;
    const buckets = documents
      .map((doc) => this.mapRollupDocument(doc))
      .filter((bucket) => {
        const ts = Date.parse(bucket.timestamp);
        return ts >= lowerBound && ts < upperBound;
      });

    if (cacheKey) {
      await this.metricsCache.set(
        cacheKey,
        JSON.stringify(buckets),
        this.rollupCacheTtlSeconds,
      );
    }

    return buckets;
  }

  /**
   * 롤업 버킷과 RAW 버킷을 timestamp 기준으로 병합해 시간순 정렬을 유지한다.
   */
  private mergeMetricBuckets(
    rollupBuckets: ServiceMetricBucket[],
    rawBuckets: ServiceMetricBucket[],
  ): ServiceMetricBucket[] {
    const merged = [...rollupBuckets, ...rawBuckets];
    if (merged.length <= 1) {
      return merged;
    }
    return merged.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  /**
   * 조회 범위 길이에 따라 롤업/RAW 윈도우를 나눈다.
   */
  private buildFetchPlan(
    normalized: NormalizedServiceMetricsQuery,
  ): MetricsFetchPlan {
    if (!this.rollupEnabled) {
      return {
        rollupWindow: null,
        rawWindow: { from: normalized.from, to: normalized.to },
      };
    }

    const fromMs = Date.parse(normalized.from);
    const toMs = Date.parse(normalized.to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
      return {
        rollupWindow: null,
        rawWindow: { from: normalized.from, to: normalized.to },
      };
    }

    if (toMs - fromMs <= this.rollupThresholdMs) {
      return {
        rollupWindow: null,
        rawWindow: { from: normalized.from, to: normalized.to },
      };
    }

    // 최신 threshold 구간만 raw 데이터로 남기고, 이전 구간은 롤업 인덱스로 대체한다.
    const splitPoint = toMs - this.rollupThresholdMs;
    if (splitPoint <= fromMs) {
      return {
        rollupWindow: null,
        rawWindow: { from: normalized.from, to: normalized.to },
      };
    }

    const rollupWindow: MetricsWindow = {
      from: normalized.from,
      to: new Date(splitPoint).toISOString(),
    };

    const rawWindow: MetricsWindow = {
      from: rollupWindow.to,
      to: normalized.to,
    };
    return {
      rollupWindow,
      rawWindow,
    };
  }

  /**
   * 롤업 인덱스 문서를 raw 메트릭 버킷과 동일한 형태로 변환한다.
   */
  private mapRollupDocument(doc: RollupMetricDocument): ServiceMetricBucket {
    const total = typeof doc.request_count === "number" ? doc.request_count : 0;
    const errors = typeof doc.error_count === "number" ? doc.error_count : 0;
    const errorRate =
      typeof doc.error_rate === "number"
        ? doc.error_rate
        : total > 0
          ? errors / total
          : 0;

    return {
      timestamp: doc["@timestamp_bucket"],
      total,
      errorRate,
      p95Latency: Number(doc.latency_p95_ms ?? 0),
      p90Latency: Number(doc.latency_p90_ms ?? 0),
      p50Latency: Number(doc.latency_p50_ms ?? 0),
    };
  }

  /**
   * 롤업 결과 캐시 키를 window 기준으로 생성한다.
   */
  private buildRollupCacheKey(
    normalized: NormalizedServiceMetricsQuery,
    window: MetricsWindow,
  ): string {
    return [
      this.rollupCachePrefix,
      `service:${normalized.serviceName}`,
      `env:${normalized.environment ?? "all"}`,
      `metric:${normalized.metric ?? "all"}`,
      `from:${window.from}`,
      `to:${window.to}`,
    ].join("|");
  }

  /**
   * 롤업 캐시를 사용할 수 있는지(TTL>0, Redis 활성 상태) 확인한다.
   */
  private rollupCacheAvailable(): boolean {
    return this.rollupCacheTtlSeconds > 0 && this.metricsCache.isEnabled();
  }

  /**
   * timestamp를 롤업 버킷 크기에 맞춰 내림 정렬한다.
   */
  private floorToBucket(timestampMs: number): number {
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
      return 0;
    }
    return Math.floor(timestampMs / this.rollupBucketMs) * this.rollupBucketMs;
  }

  /**
   * 분 단위 입력 값을 밀리초로 변환한다.
   */
  private minutesToMs(value: number): number {
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    return safe * 60 * 1000;
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
          `메트릭 성능(${label}) service=${normalized.serviceName} env=${normalized.environment ?? "all"} from=${this.formatTimestamp(normalized.from)} to=${this.formatTimestamp(normalized.to)} elapsed=${elapsed}ms`,
        );
      },
      logSummary: (responseLength) => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(
          `메트릭 총 소요 service=${normalized.serviceName} env=${normalized.environment ?? "all"} window=${this.formatTimestamp(normalized.from)}~${this.formatTimestamp(normalized.to)} metrics=${responseLength}건 elapsed=${elapsed}ms`,
        );
      },
    };
  }

  private formatTimestamp(value: string): string {
    return formatInTimeZone(value, "Asia/Seoul", "MM-dd HH:mm:ss");
  }
}

interface MetricsWindow {
  from: string;
  to: string;
}

interface MetricsFetchPlan {
  rollupWindow: MetricsWindow | null;
  rawWindow: MetricsWindow | null;
}
