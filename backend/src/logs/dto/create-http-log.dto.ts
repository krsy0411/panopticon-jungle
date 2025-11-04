import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateHttpLogDto {
  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  request_id?: string | null;

  @IsOptional()
  @IsString()
  client_ip?: string | null;

  @IsOptional()
  @IsString()
  method?: string | null;

  @IsOptional()
  @IsString()
  path?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ""
      ? undefined
      : Number(value),
  )
  @IsNumber()
  @Min(100)
  @Max(599)
  status_code?: number | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ""
      ? undefined
      : Number(value),
  )
  @IsNumber()
  @Min(0)
  request_time?: number | null;

  @IsOptional()
  @IsString()
  user_agent?: string | null;

  @IsOptional()
  @IsString()
  upstream_service?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ""
      ? undefined
      : Number(value),
  )
  @IsNumber()
  upstream_status?: number | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ""
      ? undefined
      : Number(value),
  )
  @IsNumber()
  @Min(0)
  upstream_response_time?: number | null;
}
