import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TraceQueryService } from "./trace.service";
import type { TraceResponse } from "./trace.types";

@ApiTags("traces")
@Controller("traces")
export class TraceController {
  constructor(private readonly traceService: TraceQueryService) {}

  @Get(":traceId")
  async getTrace(@Param("traceId") traceId: string): Promise<TraceResponse> {
    return this.traceService.getTrace(traceId);
  }
}
