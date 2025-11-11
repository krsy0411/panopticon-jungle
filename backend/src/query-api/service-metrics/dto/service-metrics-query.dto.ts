import {
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
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Min(1)
  intervalMinutes?: number;
}
