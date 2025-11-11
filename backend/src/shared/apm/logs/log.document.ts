import type { BaseApmDocument } from "../common/base-apm.repository";

export interface LogDocument extends BaseApmDocument {
  level: string;
  message: string;
  http_method?: string;
  http_path?: string;
  http_status_code?: number;
  labels?: Record<string, string | number | boolean>;
}
