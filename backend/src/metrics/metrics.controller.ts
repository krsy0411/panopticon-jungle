/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { MetricsService } from "./services/metrics.service";

/**
 * 통합 메트릭 컨트롤러
 * API 메트릭과 시스템 메트릭 조회 엔드포인트 제공
 */
@ApiTags("metrics")
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // ========== API 메트릭 엔드포인트 ==========

  /**
   * 최근 API 메트릭 조회
   * GET /metrics/api/recent?service=user-api&limit=100
   */
  @Get("api/recent")
  @ApiOperation({
    summary: "최근 API 메트릭 조회",
    description: "특정 서비스의 최근 API 메트릭을 조회합니다.",
  })
  @ApiQuery({
    name: "service",
    required: true,
    description: "서비스 이름 (예: user-api)",
    example: "user-api",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "조회할 메트릭 개수",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "API 메트릭 목록",
  })
  async getRecentApiMetrics(
    @Query("service") service: string,
    @Query("limit") limit?: number,
  ) {
    return this.metricsService.getRecentApiMetrics(
      service,
      limit ? parseInt(String(limit)) : 100,
    );
  }

  /**
   * 집계된 API 메트릭 조회
   * GET /metrics/api/aggregated?service=user-api&window=5&limit=100
   */
  @Get("api/aggregated")
  @ApiOperation({
    summary: "집계된 API 메트릭 조회",
    description: "특정 시간 윈도우의 집계된 API 메트릭을 조회합니다.",
  })
  @ApiQuery({
    name: "service",
    required: true,
    description: "서비스 이름",
    example: "user-api",
  })
  @ApiQuery({
    name: "window",
    required: false,
    description: "시간 윈도우 (분 단위)",
    example: 5,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "조회할 메트릭 개수",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "집계된 API 메트릭 목록",
  })
  async getAggregatedApiMetrics(
    @Query("service") service: string,
    @Query("window") window?: number,
    @Query("limit") limit?: number,
  ) {
    return this.metricsService.getAggregatedApiMetrics(
      service,
      window ? parseInt(String(window)) : 5,
      limit ? parseInt(String(limit)) : 100,
    );
  }

  // ========== 시스템 메트릭 엔드포인트 ==========

  /**
   * 최근 시스템 메트릭 조회 (서비스별)
   * GET /metrics/system/recent?service=user-api&limit=100
   */
  @Get("system/recent")
  @ApiOperation({
    summary: "최근 시스템 메트릭 조회 (서비스별)",
    description:
      "특정 서비스의 최근 시스템 메트릭 (CPU, 메모리 등)을 조회합니다.",
  })
  @ApiQuery({
    name: "service",
    required: true,
    description: "서비스 이름",
    example: "user-api",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "조회할 메트릭 개수",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "시스템 메트릭 목록",
  })
  async getRecentSystemMetrics(
    @Query("service") service: string,
    @Query("limit") limit?: number,
  ) {
    return this.metricsService.getRecentSystemMetrics(
      service,
      limit ? parseInt(String(limit)) : 100,
    );
  }

  /**
   * 최근 시스템 메트릭 조회 (Pod별)
   * GET /metrics/system/pod?pod=user-api-7d9f8b-xyz&limit=100
   */
  @Get("system/pod")
  @ApiOperation({
    summary: "최근 시스템 메트릭 조회 (Pod별)",
    description: "특정 Pod의 최근 시스템 메트릭을 조회합니다.",
  })
  @ApiQuery({
    name: "pod",
    required: true,
    description: "Pod 이름",
    example: "user-api-7d9f8b-xyz",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "조회할 메트릭 개수",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Pod별 시스템 메트릭 목록",
  })
  async getRecentSystemMetricsByPod(
    @Query("pod") podName: string,
    @Query("limit") limit?: number,
  ) {
    return this.metricsService.getRecentSystemMetricsByPod(
      podName,
      limit ? parseInt(String(limit)) : 100,
    );
  }

  /**
   * 집계된 시스템 메트릭 조회
   * GET /metrics/system/aggregated?service=user-api&window=5&bucket=1min&limit=100
   */
  @Get("system/aggregated")
  @ApiOperation({
    summary: "집계된 시스템 메트릭 조회",
    description: "특정 시간 윈도우의 집계된 시스템 메트릭을 조회합니다.",
  })
  @ApiQuery({
    name: "service",
    required: true,
    description: "서비스 이름",
    example: "user-api",
  })
  @ApiQuery({
    name: "window",
    required: false,
    description: "시간 윈도우 (분 단위)",
    example: 5,
  })
  @ApiQuery({
    name: "bucket",
    required: false,
    description: "집계 버킷 크기 (1min 또는 5min)",
    example: "1min",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "조회할 메트릭 개수",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "집계된 시스템 메트릭 목록",
  })
  async getAggregatedSystemMetrics(
    @Query("service") service: string,
    @Query("window") window?: number,
    @Query("bucket") bucket?: string,
    @Query("limit") limit?: number,
  ) {
    const bucketSize = bucket === "5min" ? "5min" : "1min";
    return this.metricsService.getAggregatedSystemMetrics(
      service,
      window ? parseInt(String(window)) : 5,
      bucketSize,
      limit ? parseInt(String(limit)) : 100,
    );
  }

  // ========== 공통 엔드포인트 ==========

  /**
   * 활성 서비스 목록 (API + System 통합)
   * GET /metrics/services
   */
  @Get("services")
  @ApiOperation({
    summary: "활성 서비스 목록 조회",
    description: "API 및 시스템 메트릭에서 활성화된 서비스 목록을 조회합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "활성 서비스 목록",
  })
  async getServices() {
    return this.metricsService.getActiveServices();
  }

  // ========== 대시보드 엔드포인트 ==========

  /**
   * 대시보드 상단 - 메트릭 요약
   * GET /metrics/summary
   */
  @Get("summary")
  @ApiOperation({
    summary: "메트릭 요약 조회",
    description: "대시보드 상단에 표시할 메트릭 요약 정보를 조회합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "메트릭 요약 정보",
  })
  async getMetricsSummary() {
    return this.metricsService.getMetricsSummary();
  }

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
    description: "집계 간격 (예: 5m, 1h)",
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
