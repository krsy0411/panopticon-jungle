import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { EndpointMetricsService } from "./endpoint-metrics.service";
import { EndpointMetricsQueryDto } from "./dto/endpoint-metrics-query.dto";
import { EndpointTraceQueryDto } from "./dto/endpoint-trace-query.dto";

/**
 * 서비스 엔드포인트 메트릭 조회 컨트롤러
 */
@ApiTags("services")
@Controller("services")
export class EndpointMetricsController {
  constructor(private readonly endpointMetrics: EndpointMetricsService) {}

  @Get(":serviceName/endpoints")
  @ApiOperation({
    summary: "엔드포인트별 메트릭 랭킹",
    description:
      "지정한 서비스 안에서 엔드포인트별 호출 수, 지연 시간, 에러율을 집계하여 상위 N개를 반환합니다. " +
      "상세 페이지의 목록/차트에 그대로 연결할 수 있도록 요청 파라미터와 응답 스키마를 고정했습니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /services/order-service/endpoints?from=2024-04-01T00:00:00Z&to=2024-04-01T01:00:00Z&environment=prod&name_filter=/api/orders&metric=request_count&sort_by=latency_p95_ms&limit=10`",
  })
  @ApiParam({
    name: "serviceName",
    description: "서비스 이름 (service.name)",
    example: "order-service",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "집계 시작 시각 (기본 현재-60분)",
    example: "2024-04-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "집계 종료 시각 (기본 현재 시각)",
    example: "2024-04-01T01:00:00Z",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "환경 필터",
    example: "prod",
  })
  @ApiQuery({
    name: "name_filter",
    required: false,
    description: "엔드포인트 이름 부분 검색 (예: HTTP 경로)",
    example: "/api/orders",
  })
  @ApiQuery({
    name: "metric",
    required: false,
    description: "프론트에서 표시할 기본 메트릭 (정렬 기본값으로도 사용)",
    enum: ["request_count", "latency_p95_ms", "error_rate"],
    example: "request_count",
  })
  @ApiQuery({
    name: "sort_by",
    required: false,
    description: "목록 정렬 기준 (기본 metric 값)",
    enum: ["request_count", "latency_p95_ms", "error_rate"],
    example: "latency_p95_ms",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "반환할 엔드포인트 수",
    example: 10,
  })
  @ApiOkResponse({
    description: "서비스 내 엔드포인트 집계 결과",
    schema: {
      type: "object",
      properties: {
        service_name: { type: "string", example: "order-service" },
        environment: {
          type: "string",
          nullable: true,
          example: "prod",
        },
        from: { type: "string", format: "date-time" },
        to: { type: "string", format: "date-time" },
        endpoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              endpoint_name: { type: "string", example: "POST /api/orders" },
              service_name: { type: "string", example: "order-service" },
              environment: { type: "string", example: "prod" },
              request_count: { type: "number", example: 5231 },
              latency_p95_ms: { type: "number", example: 340 },
              error_rate: { type: "number", example: 0.0215 },
            },
          },
          example: [
            {
              endpoint_name: "POST /api/orders",
              service_name: "order-service",
              environment: "prod",
              request_count: 5231,
              latency_p95_ms: 340,
              error_rate: 0.0215,
            },
            {
              endpoint_name: "GET /api/orders/{orderId}",
              service_name: "order-service",
              environment: "prod",
              request_count: 4120,
              latency_p95_ms: 210,
              error_rate: 0.0041,
            },
          ],
        },
      },
    },
  })
  async list(
    @Param("serviceName") serviceName: string,
    @Query() query: EndpointMetricsQueryDto,
  ) {
    return this.endpointMetrics.getEndpointMetrics(serviceName, query);
  }

  @Get(":serviceName/endpoints/:endpointName/traces")
  @ApiOperation({
    summary: "엔드포인트 문제 trace 탐색",
    description:
      "특정 서비스 엔드포인트에 대해 최근 에러 trace 또는 느린 trace를 조회합니다. " +
      "엔드포인트 테이블에서 drill-down 할 때 사용하도록 설계되었습니다.",
  })
  @ApiParam({
    name: "serviceName",
    description: "서비스 이름",
    example: "order-service",
  })
  @ApiParam({
    name: "endpointName",
    description: "엔드포인트 이름 (Span name / 경로)",
    example: "POST /api/orders",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "TRACE 필터 (ERROR 또는 SLOW)",
    enum: ["ERROR", "SLOW"],
    example: "ERROR",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "조회 시작 시각",
    example: "2024-04-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "조회 종료 시각",
    example: "2024-04-01T00:30:00Z",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "반환할 trace 수 (기본 20)",
    example: 20,
  })
  @ApiQuery({
    name: "slow_percentile",
    required: false,
    description: "status=SLOW 일 때 사용할 기준 퍼센타일 (기본 95)",
    example: 95,
  })
  @ApiOkResponse({
    description: "최근 trace 목록",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          traceId: {
            type: "string",
            example: "b7e687c6a23b298c085ef90e5e9f889f",
          },
          spanId: { type: "string", example: "982dc5757340969a" },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2025-11-15T05:15:50.802Z",
          },
          durationMs: { type: "number", example: 1850 },
          status: { type: "string", example: "ERROR" },
          serviceName: { type: "string", example: "order-service" },
          environment: { type: "string", example: "prod" },
        },
      },
      example: [
        {
          traceId: "b7e687c6a23b298c085ef90e5e9f889f",
          spanId: "982dc5757340969a",
          timestamp: "2025-11-15T05:15:50.802Z",
          durationMs: 1850,
          status: "ERROR",
          serviceName: "order-service",
          environment: "prod",
        },
      ],
    },
  })
  async listEndpointTraces(
    @Param("serviceName") serviceName: string,
    @Param("endpointName") endpointName: string,
    @Query() query: EndpointTraceQueryDto,
  ) {
    return this.endpointMetrics.getEndpointTraces(
      serviceName,
      endpointName,
      query,
    );
  }
}
