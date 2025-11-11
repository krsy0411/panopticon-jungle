import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ServiceMetricsService } from "./service-metrics.service";
import { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";
import type { MetricResponse } from "./service-metric.types";

@ApiTags("service-metrics")
@Controller("services")
export class ServiceMetricsController {
  constructor(private readonly serviceMetrics: ServiceMetricsService) {}

  @Get(":serviceName/metrics")
  @ApiOperation({
    summary: "서비스 메트릭 시계열",
    description:
      "단일 서비스의 요청 수, p95 지연 시간, 에러율을 시계열 데이터로 반환합니다. " +
      "선택한 메트릭별로 동일한 API를 호출하면 차트 위젯을 구성할 수 있습니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /services/order-service/metrics?metric=latency_p95_ms&environment=prod&from=2024-04-01T00:00:00Z&to=2024-04-01T03:00:00Z&interval=5m`",
  })
  @ApiParam({
    name: "serviceName",
    description: "대상 서비스 이름",
    example: "order-service",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "환경 필터",
    example: "prod",
  })
  @ApiQuery({
    name: "metric",
    required: false,
    description: "조회할 메트릭 (기본 http_requests_total)",
    enum: ["http_requests_total", "latency_p95_ms", "error_rate"],
    example: "latency_p95_ms",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "시작 시각 (기본 현재-60분)",
    example: "2024-04-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "종료 시각 (기본 현재)",
    example: "2024-04-01T03:00:00Z",
  })
  @ApiQuery({
    name: "interval",
    required: false,
    description: "시계열 버킷 간격 문자열 (예: 1m,5m,1h)",
    example: "5m",
  })
  @ApiQuery({
    name: "intervalMinutes",
    required: false,
    description: "간격을 분 단위 정수로 지정할 수도 있습니다.",
    example: 5,
  })
  @ApiOkResponse({
    description: "요청한 메트릭 시계열 데이터",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          metric_name: { type: "string", example: "latency_p95_ms" },
          service_name: { type: "string", example: "order-service" },
          environment: {
            type: "string",
            nullable: true,
            example: "prod",
          },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: {
                  type: "string",
                  format: "date-time",
                  example: "2024-04-01T00:05:00.000Z",
                },
                value: { type: "number", example: 285.6 },
                labels: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  example: { percentile: "p95" },
                },
              },
            },
          },
        },
      },
      example: [
        {
          metric_name: "latency_p95_ms",
          service_name: "order-service",
          environment: "prod",
          points: [
            {
              timestamp: "2024-04-01T00:05:00.000Z",
              value: 285.6,
              labels: { percentile: "p95" },
            },
            {
              timestamp: "2024-04-01T00:10:00.000Z",
              value: 301.1,
              labels: { percentile: "p95" },
            },
          ],
        },
      ],
    },
  })
  async getMetrics(
    @Param("serviceName") serviceName: string,
    @Query() query: ServiceMetricsQueryDto,
  ): Promise<MetricResponse[]> {
    return this.serviceMetrics.getMetrics(serviceName, query);
  }
}
