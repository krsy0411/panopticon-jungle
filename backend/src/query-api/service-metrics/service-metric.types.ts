export interface MetricPoint {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricResponse {
  metric_name: string;
  service_name: string;
  environment?: string;
  points: MetricPoint[];
}
