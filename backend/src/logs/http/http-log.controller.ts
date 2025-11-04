import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateHttpLogDto } from "../dto/create-http-log.dto";
import { HttpLogService } from "./http-log.service";
import { ListHttpLogsQueryDto } from "../dto/list-http-logs-query.dto";
import { HttpStatusCodeCountsQueryDto } from "../dto/http-status-code-counts-query.dto";

@ApiTags("HTTP Logs")
@Controller("logs/http")
export class HttpLogController {
  constructor(private readonly httpLogService: HttpLogService) {}

  @ApiOperation({ summary: "HTTP 접근 로그 수집" })
  @ApiBody({ type: CreateHttpLogDto })
  @ApiOkResponse({
    description: "로그가 정상적으로 수집됨",
    schema: { example: { status: "accepted" } },
  })
  @Post()
  async ingest(@Body() body: CreateHttpLogDto) {
    await this.httpLogService.ingest(body);
    return { status: "accepted" };
  }

  @ApiOperation({ summary: "HTTP 접근 로그 조회" })
  @ApiOkResponse({
    description: "HTTP 접근 로그 목록",
    schema: {
      type: "array",
      items: { type: "object" },
      example: [
        {
          "@timestamp": "2025-11-03T17:51:06.972Z",
          request_id: "e0ef68f07d57fb758d07478a623c2ee6",
          client_ip: "172.18.0.1",
          method: "GET",
          path: "/api/users/7777",
          status_code: 200,
          request_time: 0.014,
          user_agent: "curl/8.7.1",
          upstream_service: "default-log-generator-service-80",
          upstream_status: 200,
          upstream_response_time: 0.013,
          ingestedAt: "2025-11-03T17:51:06.972Z",
        },
      ],
    },
  })
  @Get()
  async list(@Query() query: ListHttpLogsQueryDto) {
    return this.httpLogService.listLogs(query);
  }

  @ApiOperation({ summary: "HTTP 상태 코드 집계 조회" })
  @ApiOkResponse({
    description: "시간 구간별 상태 코드 집계 결과",
    schema: {
      type: "object",
      properties: {
        interval: { type: "string", example: "1h" },
        buckets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: {
                type: "string",
                example: "2024-05-01T10:00:00.000+09:00",
              },
              total: { type: "integer", example: 123 },
              counts: {
                type: "object",
                additionalProperties: { type: "integer" },
                example: { "200": 110, "404": 10, "500": 3 },
              },
            },
          },
        },
      },
    },
  })
  @Get("status-code-counts")
  async getStatusCodeCounts(@Query() query: HttpStatusCodeCountsQueryDto) {
    return this.httpLogService.getStatusCodeCounts(query);
  }
}
