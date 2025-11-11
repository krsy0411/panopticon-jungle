export interface EndpointMetricsItemDto {
  endpoint_name: string;
  service_name: string;
  environment: string;
  request_count: number;
  latency_p95_ms: number;
  error_rate: number;
}

export interface EndpointMetricsResponseDto {
  service_name: string;
  environment: string | null;
  from: string;
  to: string;
  endpoints: EndpointMetricsItemDto[];
}
