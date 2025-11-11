export interface SpanItem {
  timestamp: string;
  span_id: string;
  parent_span_id?: string | null;
  name: string;
  kind: string;
  duration_ms: number;
  status: string;
  service_name: string;
  environment: string;
  labels?: Record<string, string | number | boolean>;
  http_method?: string;
  http_path?: string;
  http_status_code?: number;
}

export interface LogItem {
  timestamp: string;
  level: string;
  message: string;
  service_name: string;
  environment: string;
  trace_id?: string;
  span_id?: string;
  labels?: Record<string, string | number | boolean>;
}

export interface TraceResponse {
  trace_id: string;
  spans: SpanItem[];
  logs: LogItem[];
}
