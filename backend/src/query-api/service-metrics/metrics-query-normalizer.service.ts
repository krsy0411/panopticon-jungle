import { Injectable } from "@nestjs/common";
import { resolveTimeRange } from "../common/time-range.util";
import type { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";
import type { NormalizedServiceMetricsQuery } from "./normalized-service-metrics-query.type";

/**
 * 서비스 메트릭 조회 파라미터를 10초 단위 시간 버킷으로 맞추고
 * 캐시 키 생성을 위한 공통 형태로 정규화한다.
 */
@Injectable()
export class MetricsQueryNormalizerService {
  private readonly bucketUnitMs =
    Number(process.env.METRICS_QUANTIZATION_SECONDS ?? "10") * 1000;
  private readonly defaultWindowMinutes = Number(
    process.env.SERVICE_METRICS_DEFAULT_WINDOW_MINUTES ?? "15",
  );

  normalize(
    serviceName: string,
    query: ServiceMetricsQueryDto,
  ): NormalizedServiceMetricsQuery {
    const normalizedEnvironment = query.environment?.trim() || undefined;
    const normalizedMetric = query.metric ?? undefined;

    if (!query.from && !query.to) {
      // 클라이언트가 from/to를 지정하지 않으면 최근 n분 슬라이딩 윈도우로 간주하고 10초 단위 시간 버킷을 적용한다.
      const toDate = this.quantizeDate(new Date());
      const fromDate = new Date(
        toDate.getTime() - this.defaultWindowMinutes * 60 * 1000,
      );
      return {
        serviceName,
        environment: normalizedEnvironment,
        metric: normalizedMetric,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        interval: this.resolveInterval(query, fromDate, toDate),
        isSlidingWindow: true,
        shouldUseCache: true,
        cacheFilterSignature: this.buildFilterSignature({}),
      };
    }

    const { from, to } = resolveTimeRange(
      query.from,
      query.to,
      this.defaultWindowMinutes,
    );
    const fromDate = new Date(from);
    const toDate = new Date(to);

    return {
      serviceName,
      environment: normalizedEnvironment,
      metric: normalizedMetric,
      from,
      to,
      interval: this.resolveInterval(query, fromDate, toDate),
      isSlidingWindow: false,
      shouldUseCache: false,
      cacheFilterSignature: this.buildFilterSignature({}),
    };
  }

  /**
   * intervalMinutes/interval 파라미터를 우선 적용하고, 없으면 자동 간격을 결정한다.
   */
  private resolveInterval(
    query: ServiceMetricsQueryDto,
    from: Date,
    to: Date,
  ): string {
    const explicit = this.resolveExplicitInterval(query);
    if (explicit) {
      return explicit;
    }
    return this.autoInterval(from, to);
  }

  private resolveExplicitInterval(
    query: ServiceMetricsQueryDto,
  ): string | undefined {
    if (query.intervalMinutes) {
      const minutes = Math.max(1, Math.floor(query.intervalMinutes));
      return `${minutes}m`;
    }

    if (query.interval && /^\d+(s|m|h)$/i.test(query.interval)) {
      return query.interval;
    }

    return undefined;
  }

  /**
   * 조회 구간 길이에 따라 자동 간격을 계산한다.
   * - 30분 이하: 10~30초
   * - 2시간 이하: 1분
   * - 6시간 이하: 5분
   * - 24시간 이하: 10분
   * - 그 이상: 30분
   */
  private autoInterval(from: Date, to: Date): string {
    const diffMinutes = Math.max(
      (to.getTime() - from.getTime()) / (60 * 1000),
      1,
    );

    if (diffMinutes <= 15) {
      return "10s";
    }
    if (diffMinutes <= 30) {
      return "30s";
    }
    if (diffMinutes <= 120) {
      return "1m";
    }
    if (diffMinutes <= 360) {
      return "5m";
    }
    if (diffMinutes <= 1440) {
      return "10m";
    }
    return "30m";
  }

  /**
   * 10초 단위로 내림 버킷팅을 수행한다. (ex: 12:34:56.789 → 12:34:50)
   */
  private quantizeDate(source: Date): Date {
    const unit = Math.max(this.bucketUnitMs, 1000 * 10);
    const quantized = Math.floor(source.getTime() / unit) * unit;
    return new Date(quantized);
  }

  /**
   * 향후 endpoint/status 등 부가 필터를 추가할 때 동일 키가 생성되도록 정규화한다.
   */
  private buildFilterSignature(filters: Record<string, string | undefined>) {
    const entries = Object.entries(filters).filter(
      ([, value]) => value != null && value !== "",
    );
    if (entries.length === 0) {
      return "none";
    }

    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
  }
}
