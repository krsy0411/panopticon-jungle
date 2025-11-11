import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ServiceTraceService } from "./service-trace.service";
import { ServiceTraceQueryDto } from "./dto/service-trace-query.dto";

/**
 * 서비스별 트레이스 검색 컨트롤러
 */
@ApiTags("services")
@Controller("services")
export class ServiceTraceController {
  constructor(private readonly traceService: ServiceTraceService) {}

  @Get(":serviceName/traces")
  @ApiOperation({
    summary: "서비스별 트레이스 탐색",
    description:
      "서비스의 루트 스팬(Trace)을 상태/지연시간/시간 범위로 필터링하여 목록을 제공합니다. " +
      "트레이스 상세 화면으로 진입하기 위한 데이터 소스로 사용합니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /services/payment-service/traces?status=ERROR&min_duration_ms=1000&max_duration_ms=60000&environment=prod&from=2024-04-01T00:00:00Z&to=2024-04-01T03:00:00Z&page=1&size=20&sort=duration_desc`",
  })
  @ApiParam({
    name: "serviceName",
    description: "대상 서비스 이름",
    example: "payment-service",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "루트 스팬 상태",
    enum: ["OK", "ERROR"],
    example: "ERROR",
  })
  @ApiQuery({
    name: "min_duration_ms",
    required: false,
    description: "최소 트레이스 지속 시간",
    example: 1000,
  })
  @ApiQuery({
    name: "max_duration_ms",
    required: false,
    description: "최대 트레이스 지속 시간",
    example: 60000,
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "조회 시작 시각 (ISO8601)",
    example: "2024-04-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "조회 종료 시각 (ISO8601)",
    example: "2024-04-01T03:00:00Z",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "환경 필터",
    example: "prod",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "페이지 번호 (기본 1)",
    example: 1,
  })
  @ApiQuery({
    name: "size",
    required: false,
    description: "페이지 크기 (기본 20, 최대 200)",
    example: 20,
  })
  @ApiQuery({
    name: "sort",
    required: false,
    description: "정렬 기준",
    enum: [
      "duration_desc",
      "duration_asc",
      "start_time_desc",
      "start_time_asc",
    ],
    example: "duration_desc",
  })
  @ApiOkResponse({
    description: "서비스 루트 트레이스 목록",
    schema: {
      type: "object",
      properties: {
        total: { type: "number", example: 45 },
        page: { type: "number", example: 1 },
        size: { type: "number", example: 20 },
        traces: {
          type: "array",
          items: {
            type: "object",
            properties: {
              trace_id: {
                type: "string",
                example: "c4af1d2e3b5a6f78901234567890abcd",
              },
              root_span_name: {
                type: "string",
                example: "POST /payments/confirm",
              },
              status: { type: "string", example: "ERROR" },
              duration_ms: { type: "number", example: 18450 },
              start_time: {
                type: "string",
                format: "date-time",
                example: "2024-04-01T01:12:34.567Z",
              },
              service_name: { type: "string", example: "payment-service" },
              environment: { type: "string", example: "prod" },
              labels: {
                type: "object",
                additionalProperties: {
                  oneOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                  ],
                },
                example: {
                  region: "ap-northeast-2",
                  http_method: "POST",
                  customerTier: "enterprise",
                },
              },
            },
          },
        },
      },
    },
  })
  async search(
    @Param("serviceName") serviceName: string,
    @Query() query: ServiceTraceQueryDto,
  ) {
    return this.traceService.search(serviceName, query);
  }
}
