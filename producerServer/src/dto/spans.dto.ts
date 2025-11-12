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

// {
//   "type": "metric",
//   "timestamp": "2025-11-10T08:29:29.224Z",
//   "service_name": "ecommerce-backend",
//   "environment": "unknown",
//   "metric_name": "http.server.request.count",
//   "value": 1,
//   "labels": {
//     "service.name": "ecommerce-backend",
//     "host.name": "backend-5fdcd997fd-qk88t",
//     "host.arch": "arm64",
//     "process.pid": 1,
//     "process.executable.name": "node",
//     "process.executable.path": "/usr/local/bin/node",
//     "process.runtime.version": "20.19.5",
//     "process.runtime.name": "nodejs",
//     "process.runtime.description": "Node.js",
//     "process.command": "/app/dist/src/main.js",
//     "process.owner": "root",
//     "telemetry.sdk.language": "nodejs",
//     "telemetry.sdk.name": "opentelemetry",
//     "telemetry.sdk.version": "2.2.0",
//     "http_method": "POST",
//     "http_path": "/orders",
//     "http_status_code": "201",
//     "http_status_class": "2xx"
//   }
// }
// {
//   "type": "metric",
//   "timestamp": "2025-11-10T08:29:29.224Z",
//   "service_name": "ecommerce-backend",
//   "environment": "unknown",
//   "metric_name": "http.server.request.count",
//   "value": 1,
//   "labels": {
//     "service.name": "ecommerce-backend",
//     "host.name": "backend-5fdcd997fd-qk88t",
//     "host.arch": "arm64",
//     "process.pid": 1,
//     "process.executable.name": "node",
//     "process.executable.path": "/usr/local/bin/node",
//     "process.runtime.version": "20.19.5",
//     "process.runtime.name": "nodejs",
//     "process.runtime.description": "Node.js",
//     "process.command": "/app/dist/src/main.js",
//     "process.owner": "root",
//     "telemetry.sdk.language": "nodejs",
//     "telemetry.sdk.name": "opentelemetry",
//     "telemetry.sdk.version": "2.2.0",
//     "http_method": "POST",
//     "http_path": "/orders",
//     "http_status_code": "201",
//     "http_status_class": "2xx"
//   }
// }

// {
//   "type": "metric",
//   "timestamp": "2025-11-10T08:29:29.224Z",
//   "service_name": "ecommerce-backend",
//   "environment": "unknown",
//   "metric_name": "http.server.duration",
//   "value": 144.2,
//   "labels": {
//     "service.name": "ecommerce-backend",
//     "host.name": "backend-5fdcd997fd-qk88t",
//     "host.arch": "arm64",
//     "process.pid": 1,
//     "process.executable.name": "node",
//     "process.executable.path": "/usr/local/bin/node",
//     "process.runtime.version": "20.19.5",
//     "process.runtime.name": "nodejs",
//     "process.runtime.description": "Node.js",
//     "process.command": "/app/dist/src/main.js",
//     "process.owner": "root",
//     "telemetry.sdk.language": "nodejs",
//     "telemetry.sdk.name": "opentelemetry",
//     "telemetry.sdk.version": "2.2.0",
//     "http_method": "GET",
//     "http_path": "/cart/d43fbb2c-69b0-42d8-964e-30819bdd7cc3",
//     "http_status_code": "200",
//     "http_status_class": "2xx"
//   }
// }
