import {
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class SpanEventDto {
  readonly type = "span";

  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @IsString()
  @IsNotEmpty()
  service_name!: string;

  @IsString()
  @IsNotEmpty()
  environment!: string;

  @IsString()
  @IsNotEmpty()
  trace_id!: string;

  @IsString()
  @IsNotEmpty()
  span_id!: string;

  @IsOptional()
  @IsString()
  parent_span_id?: string | null;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(["SERVER", "CLIENT", "INTERNAL"])
  kind!: "SERVER" | "CLIENT" | "INTERNAL";

  @IsNumber()
  duration_ms!: number;

  @IsIn(["OK", "ERROR"])
  status!: "OK" | "ERROR";

  @IsOptional()
  @IsString()
  http_method?: string;

  @IsOptional()
  @IsString()
  http_path?: string;

  @IsOptional()
  http_status_code?: number;

  @IsOptional()
  @IsObject()
  labels?: Record<string, unknown>;
}
