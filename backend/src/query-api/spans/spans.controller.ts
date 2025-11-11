import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { SpanSearchService } from "./span-search.service";
import { SpanSearchQueryDto } from "./dto/span-search-query.dto";

/**
 * 스팬 검색 컨트롤러
 */
@ApiTags("spans")
@Controller("spans")
export class SpansController {
  constructor(private readonly spanService: SpanSearchService) {}

  @Get()
  @ApiOperation({
    summary: "스팬 검색",
    description:
      "하위 서비스/엔드포인트 성능을 파악하기 위해 스팬 단위 데이터를 검색합니다. " +
      "지정된 조건이 없으면 최근 15분간 수집된 스팬을 최신순으로 반환합니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /spans?service_name=checkout-service&environment=dev&name=POST%20/api/orders&kind=SERVER&status=ERROR&min_duration_ms=50&max_duration_ms=5000&trace_id=af31b2c1d3e4f5a6&parent_span_id=bf31c2d4e5f6a7b8&from=2024-04-01T00:00:00Z&to=2024-04-01T00:15:00Z&page=1&size=20&sort=duration_desc`",
  })
  @ApiQuery({
    name: "service_name",
    required: false,
    description: "스팬이 속한 서비스 이름",
    example: "checkout-service",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "배포 환경",
    example: "dev",
  })
  @ApiQuery({
    name: "name",
    required: false,
    description: "스팬 이름 (예: HTTP 경로)",
    example: "POST /api/orders",
  })
  @ApiQuery({
    name: "kind",
    required: false,
    description: "SpanKind 필터",
    enum: ["SERVER", "CLIENT", "INTERNAL"],
    example: "SERVER",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "SpanStatus 필터",
    enum: ["OK", "ERROR"],
    example: "ERROR",
  })
  @ApiQuery({
    name: "min_duration_ms",
    required: false,
    description: "최소 수행 시간(ms)",
    example: 50,
  })
  @ApiQuery({
    name: "max_duration_ms",
    required: false,
    description: "최대 수행 시간(ms)",
    example: 5000,
  })
  @ApiQuery({
    name: "trace_id",
    required: false,
    description: "특정 트레이스에 속한 스팬만 조회",
    example: "af31b2c1d3e4f5a6",
  })
  @ApiQuery({
    name: "parent_span_id",
    required: false,
    description: "부모 스팬 기준으로 하위 스팬 검색",
    example: "bf31c2d4e5f6a7b8",
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
    example: "2024-04-01T00:15:00Z",
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
    description: "페이지 크기 (기본 50, 최대 1000)",
    example: 20,
  })
  @ApiQuery({
    name: "sort",
    required: false,
    description: "정렬 기준",
    enum: [
      "duration_asc",
      "duration_desc",
      "start_time_asc",
      "start_time_desc",
    ],
    example: "duration_desc",
  })
  @ApiOkResponse({
    description: "조건을 만족하는 스팬 목록",
    schema: {
      type: "object",
      properties: {
        total: {
          type: "number",
          example: 230,
        },
        page: {
          type: "number",
          example: 1,
        },
        size: {
          type: "number",
          example: 20,
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: {
                type: "string",
                format: "date-time",
                example: "2024-04-01T00:05:12.456Z",
              },
              span_id: { type: "string", example: "84c2f4e5a6b7c8d9" },
              parent_span_id: {
                type: "string",
                nullable: true,
                example: "bf31c2d4e5f6a7b8",
              },
              name: { type: "string", example: "POST /api/orders" },
              kind: { type: "string", example: "SERVER" },
              duration_ms: { type: "number", example: 183 },
              status: { type: "string", example: "ERROR" },
              service_name: { type: "string", example: "checkout-service" },
              environment: { type: "string", example: "dev" },
              trace_id: { type: "string", example: "af31b2c1d3e4f5a6" },
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
                  http_method: "POST",
                  region: "ap-northeast-2",
                },
              },
              http_method: { type: "string", example: "POST" },
              http_path: { type: "string", example: "/api/orders" },
              http_status_code: { type: "number", example: 500 },
            },
          },
        },
      },
    },
  })
  async search(@Query() query: SpanSearchQueryDto) {
    return this.spanService.search(query);
  }
}
