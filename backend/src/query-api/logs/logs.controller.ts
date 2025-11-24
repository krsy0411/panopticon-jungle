import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { LogSearchService } from "./logs.service";
import { LogSearchQueryDto } from "./dto/log-search-query.dto";

/**
 * 로그 검색 전용 컨트롤러
 */
@ApiTags("logs")
@Controller("logs")
export class LogsController {
  constructor(private readonly logService: LogSearchService) {}

  @Get()
  @ApiOperation({
    summary: "로그 검색",
    description:
      "서비스 이름, 환경, 로그 레벨 및 트레이스 메타데이터 조합으로 Elasticsearch 로그 문서를 조회합니다. " +
      "시간 범위를 지정하지 않으면 최근 15분 데이터를 조회합니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /logs?service_name=order-service&environment=prod&level=ERROR&trace_id=3f448c0a1a02cbe7&span_id=1ab22394c4b28cda&message=결제&from=2024-04-01T00:00:00Z&to=2024-04-01T00:15:00Z&page=1&size=50&sort=desc`",
  })
  @ApiQuery({
    name: "service_name",
    required: false,
    description: "OpenTelemetry service.name 값",
    example: "order-service",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "배포 환경 태그",
    example: "prod",
  })
  @ApiQuery({
    name: "level",
    required: false,
    description: "로그 레벨 필터 (대소문자 무관)",
    enum: ["DEBUG", "INFO", "WARN", "ERROR"],
    example: "ERROR",
  })
  @ApiQuery({
    name: "trace_id",
    required: false,
    description: "연결된 트레이스 ID",
    example: "3f448c0a1a02cbe7",
  })
  @ApiQuery({
    name: "span_id",
    required: false,
    description: "연결된 스팬 ID",
    example: "1ab22394c4b28cda",
  })
  @ApiQuery({
    name: "message",
    required: false,
    description: "부분 일치 텍스트 검색 키워드",
    example: "결제 승인 실패",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "조회 시작 시각 (ISO8601). 없으면 현재-15분",
    example: "2024-04-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "조회 종료 시각 (ISO8601). 없으면 현재 시각",
    example: "2024-04-01T00:15:00Z",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "페이지 번호 (1부터 시작)",
    example: 1,
  })
  @ApiQuery({
    name: "size",
    required: false,
    description: "페이지당 문서 수 (최대 1000)",
    example: 50,
  })
  @ApiQuery({
    name: "sort",
    required: false,
    description: "타임스탬프 정렬 순서",
    enum: ["asc", "desc"],
    example: "desc",
  })
  @ApiOkResponse({
    description: "필터 조건을 만족하는 로그 목록",
    schema: {
      type: "object",
      properties: {
        total: {
          type: "number",
          example: 128,
          description: "검색 조건에 해당하는 전체 로그 수",
        },
        page: {
          type: "number",
          example: 1,
        },
        size: {
          type: "number",
          example: 50,
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: {
                type: "string",
                format: "date-time",
                example: "2024-04-01T00:02:30.123Z",
              },
              level: { type: "string", example: "ERROR" },
              message: {
                type: "string",
                example: "결제 승인 실패 - 외부 PG 응답 지연",
              },
              service_name: { type: "string", example: "order-service" },
              environment: { type: "string", example: "prod" },
              trace_id: { type: "string", example: "3f448c0a1a02cbe7" },
              span_id: { type: "string", example: "1ab22394c4b28cda" },
              labels: {
                type: "object",
                additionalProperties: {
                  oneOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                  ],
                },
                example: { host: "ip-10-0-1-15", thread: "worker-2" },
              },
            },
          },
        },
      },
    },
  })
  async search(@Query() query: LogSearchQueryDto) {
    return this.logService.search(query);
  }
}
