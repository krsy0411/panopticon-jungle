export interface TraceSummaryDto {
  trace_id: string;
  root_span_name: string;
  status: string;
  duration_ms: number;
  start_time: string;
  service_name: string;
  environment: string;
  labels?: Record<string, string | number | boolean>;
}

export interface TraceSearchResponseDto {
  total: number;
  page: number;
  size: number;
  traces: TraceSummaryDto[];
}
