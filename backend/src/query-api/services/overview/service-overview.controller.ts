import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ServiceOverviewService } from "./service-overview.service";
import { ServiceOverviewQueryDto } from "./dto/service-overview-query.dto";

/**
 * 서비스 개요 API 컨트롤러
 */
@ApiTags("services")
@Controller("services")
export class ServiceOverviewController {
  constructor(private readonly service: ServiceOverviewService) {}

  @Get()
  @ApiOperation({
    summary: "서비스 개요 집계",
    description:
      "지정한 시간 구간 동안 수집된 스팬을 기반으로 서비스별 호출 건수, p95 지연 시간, 에러율 상위 목록을 제공합니다. " +
      "대시보드 기본 카드 또는 전체 서비스 드롭다운 등에 그대로 사용할 수 있도록 정렬 및 검색 필터를 지원합니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /services?from=2024-04-01T00:00:00Z&to=2024-04-01T01:00:00Z&environment=prod&name_filter=order&sort_by=request_count&limit=20`",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "조회 시작 시각 (ISO8601). 기본값은 현재-60분",
    example: "2024-04-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "조회 종료 시각 (ISO8601). 기본값은 현재 시각",
    example: "2024-04-01T01:00:00Z",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "환경 필터 (prod/dev 등)",
    example: "prod",
  })
  @ApiQuery({
    name: "name_filter",
    required: false,
    description: "서비스 이름 부분 검색",
    example: "order",
  })
  @ApiQuery({
    name: "sort_by",
    required: false,
    description: "정렬 기준 (기본 request_count)",
    enum: ["request_count", "latency_p95_ms", "error_rate"],
    example: "request_count",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "조회할 서비스 수 (기본 50)",
    example: 20,
  })
  @ApiOkResponse({
    description: "시간 구간 내 서비스 요약 목록",
    schema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          nullable: true,
          example: "2024-04-01T00:00:00.000Z",
        },
        to: {
          type: "string",
          nullable: true,
          example: "2024-04-01T01:00:00.000Z",
        },
        environment: {
          type: "string",
          nullable: true,
          example: "prod",
        },
        services: {
          type: "array",
          items: {
            type: "object",
            properties: {
              service_name: { type: "string", example: "order-service" },
              environment: { type: "string", example: "prod" },
              request_count: { type: "number", example: 15342 },
              latency_p95_ms: { type: "number", example: 280 },
              error_rate: { type: "number", format: "float", example: 0.0123 },
            },
          },
          example: [
            {
              service_name: "order-service",
              environment: "prod",
              request_count: 15342,
              latency_p95_ms: 280,
              error_rate: 0.0123,
            },
            {
              service_name: "payment-service",
              environment: "prod",
              request_count: 8421,
              latency_p95_ms: 410,
              error_rate: 0.0345,
            },
          ],
        },
      },
    },
  })
  async list(@Query() query: ServiceOverviewQueryDto) {
    return this.service.getOverview(query);
  }
}
