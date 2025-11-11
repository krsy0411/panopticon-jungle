import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { TraceQueryService } from "./trace.service";
import type { TraceResponse } from "./trace.types";
import { TraceLookupQueryDto } from "./dto/trace-lookup-query.dto";

@ApiTags("traces")
@Controller("traces")
export class TraceController {
  constructor(private readonly traceService: TraceQueryService) {}

  @Get(":traceId")
  @ApiOperation({
    summary: "단일 트레이스 상세",
    description:
      "트레이스 ID 기준으로 전체 스팬과 연결된 로그를 함께 반환합니다. 서비스/환경을 추가로 지정하면 동일 ID가 여러 환경에 존재하는 경우를 구분할 수 있습니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /traces/c4af1d2e3b5a6f78901234567890abcd?service=payment-service&environment=prod`",
  })
  @ApiParam({
    name: "traceId",
    description: "조회할 트레이스 ID",
    example: "c4af1d2e3b5a6f78901234567890abcd",
  })
  @ApiQuery({
    name: "environment",
    required: false,
    description: "환경 필터 (필요 시)",
    example: "prod",
  })
  @ApiQuery({
    name: "service",
    required: false,
    description: "서비스 이름을 명시하면 동일 trace_id 충돌을 방지할 수 있습니다.",
    example: "payment-service",
  })
  @ApiOkResponse({
    description: "트레이스에 속한 전체 스팬과 로그",
    schema: {
      type: "object",
      properties: {
        trace_id: { type: "string", example: "c4af1d2e3b5a6f78901234567890abcd" },
        spans: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: {
                type: "string",
                format: "date-time",
                example: "2024-04-01T01:12:34.567Z",
              },
              span_id: { type: "string", example: "84c2f4e5a6b7c8d9" },
              parent_span_id: {
                type: "string",
                nullable: true,
                example: null,
              },
              name: { type: "string", example: "POST /payments/confirm" },
              kind: { type: "string", example: "SERVER" },
              duration_ms: { type: "number", example: 18450 },
              status: { type: "string", example: "ERROR" },
              service_name: { type: "string", example: "payment-service" },
              environment: { type: "string", example: "prod" },
              trace_id: { type: "string", example: "c4af1d2e3b5a6f78901234567890abcd" },
              labels: {
                type: "object",
                additionalProperties: {
                  oneOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                  ],
                },
                example: { http_method: "POST", db_statement: "UPDATE payments" },
              },
              http_method: { type: "string", example: "POST" },
              http_path: { type: "string", example: "/payments/confirm" },
              http_status_code: { type: "number", example: 500 },
            },
          },
        },
        logs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: {
                type: "string",
                format: "date-time",
                example: "2024-04-01T01:12:34.600Z",
              },
              level: { type: "string", example: "ERROR" },
              message: {
                type: "string",
                example: "PG 사 응답 지연으로 결제 승인 실패",
              },
              service_name: { type: "string", example: "payment-service" },
              environment: { type: "string", example: "prod" },
              trace_id: { type: "string", example: "c4af1d2e3b5a6f78901234567890abcd" },
              span_id: { type: "string", example: "84c2f4e5a6b7c8d9" },
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
                  host: "ip-10-1-5-21",
                  thread: "worker-2",
                },
              },
            },
          },
        },
      },
    },
  })
  async getTrace(
    @Param("traceId") traceId: string,
    @Query() query: TraceLookupQueryDto,
  ): Promise<TraceResponse> {
    return this.traceService.getTrace(traceId, query);
  }
}
