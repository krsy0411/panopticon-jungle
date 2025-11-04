import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CreateAppLogDto } from "../dto/create-app-log.dto";
import { ListAppLogsQueryDto } from "../dto/list-app-logs-query.dto";
import { AppLogService } from "./app-log.service";

@ApiTags("App Logs")
@Controller("logs/app")
export class AppLogController {
  constructor(private readonly appLogService: AppLogService) {}

  @ApiOperation({ summary: "Ingest a new application log entry" })
  @ApiBody({ type: CreateAppLogDto })
  @ApiOkResponse({
    description: "Log accepted",
    schema: { example: { status: "accepted" } },
  })
  @Post()
  async ingest(@Body() body: CreateAppLogDto, @Req() req: Request) {
    await this.appLogService.ingest(body, {
      remoteAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return { status: "accepted" };
  }

  @ApiOperation({ summary: "List application logs" })
  @ApiOkResponse({
    description: "List of application logs",
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
