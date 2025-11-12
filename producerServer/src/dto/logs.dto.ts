import { IsString, IsOptional, IsNumber } from 'class-validator';

export class LogDto {
  @IsString()
  type: string;

  @IsString()
  timestamp: string;

  @IsString()
  service_name: string;

  @IsString()
  environment: string;

  @IsString()
  level: string;

  @IsString()
  message: string;

  @IsString()
  trace_id: string;

  @IsString()
  span_id: string;

  // 선택 필드 (있으면 오는 데이터)
  @IsOptional()
  @IsString()
  http_method?: string;

  @IsOptional()
  @IsString()
  http_path?: string;

  @IsOptional()
  @IsNumber()
  http_status_code?: number;

  @IsOptional()
  @IsNumber()
  duration_ms?: number;

  @IsOptional()
  @IsString()
  client_ip?: string;
}

export class LogBatchDto {
  logs: LogDto[];
}
// {
//   "type": "log",
//   "timestamp": "2025-11-10T07:17:00.583Z",
//   "service_name": "order-service",
//   "environment": "production",
//   "level": "INFO",
//   "message": "GET /users",
//   "trace_id": "98a94347530b375f951d56bda45b50c4",
//   "span_id": "5f13c248640e06ca",
//   "http_method": "GET",
//   "http_path": "/users",
//   "http_status_code": 200,
//   "duration_ms": 4.31,
//   "client_ip": "::ffff:10.244.0.16"
// }
