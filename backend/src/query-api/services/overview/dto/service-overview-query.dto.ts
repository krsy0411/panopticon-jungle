import { IsISO8601, IsIn, IsInt, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class ServiceOverviewQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  name_filter?: string;

  @IsOptional()
  @IsIn(["request_count", "latency_p95_ms", "error_rate"])
  sort_by?: "request_count" | "latency_p95_ms" | "error_rate";

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(1)
  limit?: number;
}
