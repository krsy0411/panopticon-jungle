export interface ServiceSummaryDto {
  service_name: string;
  environment: string;
  request_count: number;
  latency_p95_ms: number;
  error_rate: number;
}

export interface ServiceOverviewResponseDto {
  from: string | null;
  to: string | null;
  environment?: string | null;
  services: ServiceSummaryDto[];
}
