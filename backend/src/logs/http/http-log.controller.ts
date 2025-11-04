import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import type { CreateHttpLogDto } from "../dto/create-http-log.dto";
import { HttpLogService } from "./http-log.service";
import { ListHttpLogsQueryDto } from "../dto/list-http-logs-query.dto";

@Controller("logs/http")
export class HttpLogController {
  constructor(private readonly httpLogService: HttpLogService) {}

  @Post()
  async ingest(@Body() body: CreateHttpLogDto) {
    await this.httpLogService.ingest(body);
    return { status: "accepted" };
  }

  @Get()
  async list(@Query() query: ListHttpLogsQueryDto) {
    return this.httpLogService.listLogs(query);
  }
}
