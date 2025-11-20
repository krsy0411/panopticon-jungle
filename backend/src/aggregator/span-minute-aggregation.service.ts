import { Injectable, Logger } from "@nestjs/common";
import type { Client } from "@elastic/elasticsearch";
import { LogStorageService } from "../shared/logs/log-storage.service";
import type { MinuteWindow } from "./types/minute-window.type";
import type { RollupMetricDocument } from "./types/rollup-metric-document";
import { RollupConfigService } from "./rollup-config.service";

const UNKNOWN_SERVICE = "unknown-service";
const UNKNOWN_ENVIRONMENT = "unknown";

interface AggregationResponse {
  services?: {
    buckets: Array<{
      key: string;
      doc_count: number;
      environments: {
        buckets: Array<{
          key: string;
          doc_count: number;
          latency: { values: Record<string, number> };
          errors: { doc_count: number };
        }>;
      };
    }>;
  };
}

/**
 * 스팬 원본 데이터를 1분 단위로 집계해 롤업 문서를 생성한다.
 */
@Injectable()
export class SpanMinuteAggregationService {
  private readonly logger = new Logger(SpanMinuteAggregationService.name);
  private readonly client: Client;
  private readonly spanIndex: string;

  constructor(
    storage: LogStorageService,
    private readonly config: RollupConfigService,
  ) {
    this.client = storage.getClient();
    this.spanIndex = storage.getDataStream("apmSpans");
  }

  async aggregate(window: MinuteWindow): Promise<RollupMetricDocument[]> {
    // ES 집계 쿼리 시간이 얼마나 걸렸는지 추적한다.
    const queryStarted = Date.now();
    const body = await this.client.search<unknown, AggregationResponse>({
      index: this.spanIndex,
      size: 0,
      query: {
        bool: {
          must: [{ term: { kind: "SERVER" } }],
          filter: [
            {
              range: {
                "@timestamp": {
                  gte: window.start.toISOString(),
                  lt: window.end.toISOString(),
                },
              },
            },
          ],
        },
      },
      aggs: {
        services: {
          terms: {
            field: "service_name",
            size: this.config.getMaxServiceBuckets(),
            missing: UNKNOWN_SERVICE,
          },
          aggs: {
            environments: {
              terms: {
                field: "environment",
                size: this.config.getMaxEnvironmentBuckets(),
                missing: UNKNOWN_ENVIRONMENT,
              },
              aggs: {
                latency: {
                  percentiles: {
                    field: "duration_ms",
                    percents: [50, 90, 95],
                  },
                },
                errors: {
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

    const took = Date.now() - queryStarted;
    const services =
      body.aggregations?.services?.buckets ??
      (body as unknown as AggregationResponse).services?.buckets ??
      [];

    const bucketDocs: RollupMetricDocument[] = [];
    const ingestedAt = new Date().toISOString();
    const bucketDurationSeconds = this.config.getBucketDurationSeconds();

    for (const serviceBucket of services) {
      const serviceName = serviceBucket.key || UNKNOWN_SERVICE;
      for (const envBucket of serviceBucket.environments.buckets) {
        const environment = envBucket.key || UNKNOWN_ENVIRONMENT;
        const total = envBucket.doc_count ?? 0;
        const errors = envBucket.errors.doc_count ?? 0;
        if (total === 0) {
          continue;
        }

        const doc: RollupMetricDocument = {
          "@timestamp": window.start.toISOString(),
          "@timestamp_bucket": window.start.toISOString(),
          bucket_duration_seconds: bucketDurationSeconds,
          service_name: serviceName,
          environment,
          request_count: total,
          error_count: errors,
          error_rate: total > 0 ? errors / total : 0,
          latency_p50_ms: this.extractPercentile(
            envBucket.latency.values,
            "50",
          ),
          latency_p90_ms: this.extractPercentile(
            envBucket.latency.values,
            "90",
          ),
          latency_p95_ms: this.extractPercentile(
            envBucket.latency.values,
            "95",
          ),
          source_window_from: window.start.toISOString(),
          source_window_to: window.end.toISOString(),
          ingestedAt,
        };
        bucketDocs.push(doc);
      }
    }

    if (bucketDocs.length === 0) {
      this.logger.log(
        `집계 대상 스팬이 없어 비어 있는 분을 건너뜁니다. window=${window.start.toISOString()}~${window.end.toISOString()} es_took=${took}ms`,
      );
    } else {
      this.logger.log(
        `스팬 집계 완료 window=${window.start.toISOString()}~${window.end.toISOString()} services=${services.length} docs=${bucketDocs.length} es_took=${took}ms`,
      );
    }

    return bucketDocs;
  }

  private extractPercentile(
    values: Record<string, number>,
    percentile: string,
  ): number {
    const preciseKey = `${percentile}.0`;
    const raw = values[preciseKey] ?? values[percentile] ?? 0;
    return Number.isFinite(raw) ? raw : 0;
  }
}
