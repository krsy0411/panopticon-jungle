import {
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class LogEventDto {
  readonly type = "log";

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
  @IsIn(["DEBUG", "INFO", "WARN", "ERROR"])
  level!: "DEBUG" | "INFO" | "WARN" | "ERROR";

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsString()
  trace_id?: string;

  @IsOptional()
  @IsString()
  span_id?: string;

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
