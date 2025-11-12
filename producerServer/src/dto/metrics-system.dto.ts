import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class MetricsSystemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsNumber()
  cpu?: number;

  @IsOptional()
  @IsNumber()
  memory?: number;

  @IsOptional()
  @IsNumber()
  disk?: number;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class MetricsSystemBatchDto {
  metrics: MetricsSystemDto[];
}
