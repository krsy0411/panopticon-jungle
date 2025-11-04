import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateHttpLogDto } from "../dto/create-http-log.dto";
import { HttpLogService } from "./http-log.service";
import { ListHttpLogsQueryDto } from "../dto/list-http-logs-query.dto";

@ApiTags("HTTP Logs")
@Controller("logs/http")
export class HttpLogController {
  constructor(private readonly httpLogService: HttpLogService) {}

  @ApiOperation({ summary: "Ingest a new HTTP access log entry" })
  @ApiBody({ type: CreateHttpLogDto })
  @ApiOkResponse({
    description: "Log accepted",
    schema: { example: { status: "accepted" } },
  })
  @Post()
  async ingest(@Body() body: CreateHttpLogDto) {
    await this.httpLogService.ingest(body);
    return { status: "accepted" };
  }

  @ApiOperation({ summary: "List HTTP access logs" })
  @ApiOkResponse({
    description: "List of HTTP logs",
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
}
