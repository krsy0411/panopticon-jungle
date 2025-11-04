import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import type { Request } from "express";
import { CreateLogDto } from "./dto/create-logs.dto";
import { ListLogsQueryDto } from "./dto/list-logs-query.dto";
import { LogService } from "./logs.service";

@ApiTags("logs")
@Controller("logs")
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Post()
  @ApiOperation({
    summary: "로그 수집",
    description: "애플리케이션 로그를 수집합니다.",
  })
  @ApiBody({
    type: CreateLogDto,
    description: "로그 데이터",
  })
  @ApiResponse({
    status: 201,
    description: "로그 수집 성공",
    schema: {
      properties: {
        status: { type: "string", example: "accepted" },
      },
    },
  })
  async ingest(@Body() body: CreateLogDto, @Req() req: Request) {
    await this.logService.ingest(body, {
      remoteAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });
    return { status: "accepted" };
  }

  @Get()
  @ApiOperation({
    summary: "로그 조회",
    description: "로그를 검색하고 조회합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "로그 목록",
  })
  async list(@Query() query: ListLogsQueryDto) {
    return this.logService.listLogs(query);
  }
}
