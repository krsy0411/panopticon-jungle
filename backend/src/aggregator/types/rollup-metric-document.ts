/**
 * 롤업 된 APM 메트릭 문서 스키마
 * - Elasticsearch data stream(metrics-apm.*)에 그대로 저장된다.
 */
export interface RollupMetricDocument extends Record<string, unknown> {
  "@timestamp": string;
  "@timestamp_bucket": string;
  bucket_duration_seconds: number;
  service_name: string;
  environment: string;
  target?: string | null;
  request_count: number;
  error_count: number;
  error_rate: number;
  latency_p50_ms: number;
  latency_p90_ms: number;
  latency_p95_ms: number;
  latency_p99_ms?: number;
  source_window_from: string;
  source_window_to: string;
  ingestedAt: string;
}
