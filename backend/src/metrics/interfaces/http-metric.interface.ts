/**
 * HTTP API 메트릭 인터페이스
 * API 요청/응답 관련 메트릭 (Latency, Error, Traffic 등)
 */

export interface HttpMetricData {
  service: string;
  endpoint?: string;
  method?: string;
  latency?: number;
  status?: number;
  timestamp: number;
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export interface ErrorMetrics {
  error_count: number;
  total_count: number;
  error_rate: number;
}

export interface TrafficMetrics {
  request_count: number;
  tps: number;
}

export interface SaturationMetrics {
  cpu_usage: number;
  memory_usage: number;
}

export interface GoldenSignals {
  latency: LatencyMetrics;
  error: ErrorMetrics;
  traffic: TrafficMetrics;
  saturation: SaturationMetrics;
}
