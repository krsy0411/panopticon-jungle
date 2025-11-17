import { Type } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from "class-validator";

export class EndpointTraceQueryDto {
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
  @IsIn(["ERROR", "SLOW"])
  status?: "ERROR" | "SLOW";

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(50)
  @Type(() => Number)
  slow_percentile?: number;
}
