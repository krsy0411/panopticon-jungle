import { Injectable } from "@nestjs/common";
import { SpanRepository } from "../../shared/apm/spans/span.repository";
import type { ServiceMetricBucket } from "../../shared/apm/spans/span.repository";
import type { MetricResponse } from "./service-metric.types";
import type { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";

interface MetricComputationParams {
  serviceName: string;
  environment?: string;
  from: string;
  to: string;
  intervalMinutes: number;
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
    return this.toMetricResponses(serviceName, params.environment, buckets);
  }

  private buildParams(
    serviceName: string,
    query: ServiceMetricsQueryDto,
  ): MetricComputationParams {
    const intervalMinutes = query.intervalMinutes ?? 1;
    const to = query.to ?? new Date().toISOString();
    const from =
      query.from ?? new Date(Date.now() - 15 * 60 * 1000).toISOString();

    return {
      serviceName,
      environment: query.environment,
      from,
      to,
      intervalMinutes,
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

    const latencyPoints = buckets.map((bucket) => ({
      timestamp: bucket.timestamp,
      value: bucket.p95Latency,
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
        environment,
        points: qpsPoints,
      },
      {
        metric_name: "latency_p95_ms",
        service_name: serviceName,
        environment,
        points: latencyPoints,
      },
      {
        metric_name: "error_rate",
        service_name: serviceName,
        environment,
        points: errorRatePoints,
      },
    ];
  }

  private baseLabels(environment?: string): Record<string, string> | undefined {
    return environment ? { environment } : undefined;
  }
}
