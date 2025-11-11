export interface SpanItemDto {
  timestamp: string;
  span_id: string;
  parent_span_id?: string | null;
  name: string;
  kind: "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER" | "INTERNAL";
  duration_ms: number;
  status: "OK" | "ERROR" | "UNSET";
  service_name: string;
  environment: string;
  trace_id?: string;
  labels?: Record<string, string | number | boolean>;
  http_method?: string;
  http_path?: string;
  http_status_code?: number;
}

export interface LogItemDto {
  timestamp: string;
  level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  message: string;
  service_name: string;
  environment: string;
  trace_id?: string;
  span_id?: string;
  labels?: Record<string, string | number | boolean>;
}

export interface TraceResponseDto {
  trace_id: string;
  spans: SpanItemDto[];
  logs: LogItemDto[];
}
