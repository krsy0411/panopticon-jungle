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
 * 서비스별 트레이스 검색 파라미터 DTO
 */
export class ServiceTraceQueryDto {
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
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  size?: number;

  @IsOptional()
  @IsIn([
    "duration_desc",
    "duration_asc",
    "start_time_desc",
    "start_time_asc",
  ])
  sort?:
    | "duration_desc"
    | "duration_asc"
    | "start_time_desc"
    | "start_time_asc";
}
