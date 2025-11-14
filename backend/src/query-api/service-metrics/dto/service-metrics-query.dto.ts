import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from "class-validator";

export class ServiceMetricsQueryDto {
  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsIn([
    "http_requests_total",
    "latency_p95_ms",
    "latency_p90_ms",
    "latency_p50_ms",
    "error_rate",
  ])
  metric?:
    | "http_requests_total"
    | "latency_p95_ms"
    | "latency_p90_ms"
    | "latency_p50_ms"
    | "error_rate";

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  interval?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(1)
  intervalMinutes?: number;
}
