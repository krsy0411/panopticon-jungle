import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListAppLogsQueryDto } from "../../../shared/logs/dto/list-app-logs-query.dto";
import { AppLogQueryService } from "./app-log.service";

@ApiTags("App Logs")
@Controller("logs/app")
export class AppLogController {
  constructor(private readonly appLogService: AppLogQueryService) {}

  @ApiOperation({ summary: "애플리케이션 로그 조회" })
  @ApiOkResponse({
    description: "애플리케이션 로그 목록",
    schema: {
      type: "array",
      items: { type: "object" },
      example: [
        {
          "@timestamp": "2024-12-26T12:34:56.123Z",
          service: "payment-service",
          level: "info",
          message: "checkout completed",
          remoteAddress: "127.0.0.1",
          userAgent: "curl/8.7.1",
          ingestedAt: "2024-12-26T12:34:56.123Z",
        },
      ],
    },
  })
  @Get()
  async list(@Query() query: ListAppLogsQueryDto) {
    return this.appLogService.listLogs(query);
  }
}
