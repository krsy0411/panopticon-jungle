import { Injectable } from "@nestjs/common";
import { SpanRepository } from "../../shared/apm/spans/span.repository";
import type { ServiceMetricBucket } from "../../shared/apm/spans/span.repository";
import { resolveTimeRange } from "../common/time-range.util";
import type { MetricResponse } from "./service-metric.types";
import type { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";

/**
 * 시계열 집계를 위한 내부 파라미터
 * - from/to: 조회 구간
 * - interval: date_histogram 에 전달할 간격 표현식(예: 1m, 5m)
 */
interface MetricComputationParams {
  serviceName: string;
  environment?: string;
  from: string;
  to: string;
  interval: string;
}

@Injectable()
export class ServiceMetricsService {
  constructor(private readonly spanRepository: SpanRepository) {}

  async getMetrics(
    serviceName: string,
    query: ServiceMetricsQueryDto,
  ): Promise<MetricResponse[]> {
    const params = this.buildParams(serviceName, query);
    const buckets = await this.spanRepository.aggregateServiceMetrics(params);
    const metrics = this.toMetricResponses(
      serviceName,
      params.environment,
      buckets,
    );

    if (query.metric) {
      return metrics.filter((item) => item.metric_name === query.metric);
    }

    return metrics;
  }

  private buildParams(
    serviceName: string,
    query: ServiceMetricsQueryDto,
  ): MetricComputationParams {
    const { from, to } = resolveTimeRange(query.from, query.to, 15);
    const interval =
      this.resolveIntervalExpression(query) ?? this.autoInterval(from, to);

    return {
      serviceName,
      environment: query.environment,
      from,
      to,
      interval,
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

  private resolveIntervalExpression(
    query: ServiceMetricsQueryDto,
  ): string | undefined {
    if (query.intervalMinutes) {
      const minutes = Math.max(1, Math.floor(query.intervalMinutes));
      return `${minutes}m`;
    }

    if (query.interval && /^\d+(s|m|h)$/.test(query.interval)) {
      return query.interval;
    }

    return undefined;
  }

  private autoInterval(from: string, to: string): string {
    const diffMs = new Date(to).getTime() - new Date(from).getTime();
    const diffMinutes = Math.max(diffMs / (60 * 1000), 1);

    if (diffMinutes <= 30) {
      return "1m";
    }
    if (diffMinutes <= 120) {
      return "5m";
    }
    if (diffMinutes <= 360) {
      return "15m";
    }
    if (diffMinutes <= 1440) {
      return "30m";
    }
    return "1h";
  }
}
