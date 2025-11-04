import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { CreateAppLogDto } from "../dto/create-app-log.dto";
import { ListAppLogsQueryDto } from "../dto/list-app-logs-query.dto";
import { AppLogService } from "./app-log.service";

@Controller("logs/app")
export class AppLogController {
  constructor(private readonly appLogService: AppLogService) {}

  @Post()
  async ingest(@Body() body: CreateAppLogDto, @Req() req: Request) {
    await this.appLogService.ingest(body, {
      remoteAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return { status: "accepted" };
  }

  @Get()
  async list(@Query() query: ListAppLogsQueryDto) {
    return this.appLogService.listLogs(query);
  }
}
