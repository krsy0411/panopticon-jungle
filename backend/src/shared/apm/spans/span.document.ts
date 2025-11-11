import type { BaseApmDocument } from "../common/base-apm.repository";

export interface SpanDocument extends BaseApmDocument {
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  name: string;
  kind: "SERVER" | "CLIENT" | "INTERNAL";
  duration_ms: number;
  status: "OK" | "ERROR";
  http_method?: string;
  http_path?: string;
  http_status_code?: number;
  labels?: Record<string, string | number | boolean>;
}
