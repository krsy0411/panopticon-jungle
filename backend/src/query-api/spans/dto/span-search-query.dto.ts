import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

/**
 * 스팬 검색 파라미터 DTO
 */
export class SpanSearchQueryDto {
  @IsOptional()
  @IsString()
  service_name?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(["SERVER", "CLIENT", "INTERNAL"])
  kind?: "SERVER" | "CLIENT" | "INTERNAL";

  @IsOptional()
  @IsIn(["OK", "ERROR"])
  status?: "OK" | "ERROR";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min_duration_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max_duration_ms?: number;

  @IsOptional()
  @IsString()
  trace_id?: string;

  @IsOptional()
  @IsString()
  parent_span_id?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  size?: number;

  @IsOptional()
  @IsIn(["duration_asc", "duration_desc", "start_time_asc", "start_time_desc"])
  sort?:
    | "duration_asc"
    | "duration_desc"
    | "start_time_asc"
    | "start_time_desc";
}
