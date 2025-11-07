import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { MetricsService } from "../../shared/metrics/services/metrics.service";

/**
 * 메트릭 컨트롤러
 * 시계열 메트릭 조회 엔드포인트 제공
 */
@ApiTags("api/metrics")
@Controller("api/metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * 대시보드 하단 - 시계열 데이터
   * GET /metrics/timeseries?range=12h&interval=5m
   */
  @Get("timeseries")
  @ApiOperation({
    summary: "시계열 메트릭 조회",
    description: "대시보드 하단에 표시할 시계열 메트릭 데이터를 조회합니다.",
  })
  @ApiQuery({
    name: "range",
    required: false,
    description: "조회 범위 (예: 12h, 24h, 7d)",
    example: "12h",
  })
  @ApiQuery({
    name: "interval",
    required: false,
    description: "집계 간격 (예: 1m, 5m, 1h)",
    example: "5m",
  })
  @ApiResponse({
    status: 200,
    description: "시계열 메트릭 데이터",
  })
  async getMetricsTimeseries(
    @Query("range") range?: string,
    @Query("interval") interval?: string,
  ) {
    return this.metricsService.getMetricsTimeseries(
      range || "12h",
      interval || "5m",
    );
  }
}
