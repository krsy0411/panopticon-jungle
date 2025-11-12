import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class MetricsHttpDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsNumber()
  statusCode?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class MetricsHttpBatchDto {
  metrics: MetricsHttpDto[];
}
