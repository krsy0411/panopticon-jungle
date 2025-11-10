import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class SpanDto {
  @IsOptional()
  @IsString()
  traceId?: string;

  @IsOptional()
  @IsString()
  spanId?: string;

  @IsOptional()
  @IsString()
  parentSpanId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SpanBatchDto {
  spans: SpanDto[];
}
