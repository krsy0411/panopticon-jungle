import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

/**
 * 로그 검색 API의 쿼리 파라미터 DTO
 */
export class LogSearchQueryDto {
  @IsOptional()
  @IsString()
  service_name?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsIn(["DEBUG", "INFO", "WARN", "ERROR"])
  level?: "DEBUG" | "INFO" | "WARN" | "ERROR";

  @IsOptional()
  @IsString()
  trace_id?: string;

  @IsOptional()
  @IsString()
  span_id?: string;

  @IsOptional()
  @IsString()
  message?: string;

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
  @IsIn(["asc", "desc"])
  sort?: "asc" | "desc";
}
