import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { CreateLogDto } from "./dto/create-logs.dto";
import { ListLogsQueryDto } from "./dto/list-logs-query.dto";
import { LogService } from "./logs.service";

@Controller("logs")
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Post()
  async ingest(@Body() body: CreateLogDto, @Req() req: Request) {
    await this.logService.ingest(body, {
      remoteAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return { status: "accepted" };
  }

  @Get()
  async list(@Query() query: ListLogsQueryDto) {
    return this.logService.listLogs(query);
  }
}
