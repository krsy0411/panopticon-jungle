/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Query } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

/**
 * 통합 메트릭 컨트롤러
 * API 메트릭과 시스템 메트릭 조회 엔드포인트 제공
 */
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // ========== API 메트릭 엔드포인트 ==========

  /**
   * 최근 API 메트릭 조회
   * GET /metrics/api/recent?service=user-api&limit=100
   */
  @Get("api/recent")
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
   * GET /metrics/api/aggregated?service=user-api&window=5
   */
  @Get("api/aggregated")
  async getAggregatedApiMetrics(
    @Query("service") service: string,
    @Query("window") window?: number,
  ) {
    return this.metricsService.getAggregatedApiMetrics(
      service,
      window ? parseInt(String(window)) : 5,
    );
  }

  // ========== 시스템 메트릭 엔드포인트 ==========

  /**
   * 최근 시스템 메트릭 조회 (서비스별)
   * GET /metrics/system/recent?service=user-api&limit=100
   */
  @Get("system/recent")
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
   * GET /metrics/system/aggregated?service=user-api&window=5&bucket=1min
   */
  @Get("system/aggregated")
  async getAggregatedSystemMetrics(
    @Query("service") service: string,
    @Query("window") window?: number,
    @Query("bucket") bucket?: string,
  ) {
    const bucketSize = bucket === "5min" ? "5min" : "1min";
    return this.metricsService.getAggregatedSystemMetrics(
      service,
      window ? parseInt(String(window)) : 5,
      bucketSize,
    );
  }

  // ========== 공통 엔드포인트 ==========

  /**
   * 활성 서비스 목록 (API + System 통합)
   * GET /metrics/services
   */
  @Get("services")
  async getServices() {
    return this.metricsService.getActiveServices();
  }
}
