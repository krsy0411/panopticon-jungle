/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from "@nestjs/common";
import { ApiMetricsRepository } from "./api-metrics.repository";
import { SystemMetricsRepository } from "./system-metrics.repository";

/**
 * 통합 메트릭 조회 서비스
 * API 메트릭과 시스템 메트릭 조회 기능 제공
 */
@Injectable()
export class MetricsService {
  constructor(
    private readonly apiMetricsRepo: ApiMetricsRepository,
    private readonly systemMetricsRepo: SystemMetricsRepository,
  ) {}

  // ========== API 메트릭 조회 ==========

  /**
   * 최근 API 메트릭 조회
   */
  async getRecentApiMetrics(service: string, limit: number = 100) {
    return this.apiMetricsRepo.getRecentMetrics(service, limit);
  }

  /**
   * 시간 범위별 집계 API 메트릭 조회
   */
  async getAggregatedApiMetrics(
    service: string,
    windowMinutes: number = 5,
    limit: number = 100,
  ) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);
    const results = await this.apiMetricsRepo.getAggregatedMetrics(
      service,
      startTime,
      endTime,
    );
    return results.slice(0, limit);
  }

  // ========== 시스템 메트릭 조회 ==========

  /**
   * 최근 시스템 메트릭 조회 (서비스별)
   */
  async getRecentSystemMetrics(service: string, limit: number = 100) {
    return this.systemMetricsRepo.getRecentMetrics(service, limit);
  }

  /**
   * 최근 시스템 메트릭 조회 (Pod별)
   */
  async getRecentSystemMetricsByPod(podName: string, limit: number = 100) {
    return this.systemMetricsRepo.getRecentMetricsByPod(podName, limit);
  }

  /**
   * 시간 범위별 집계 시스템 메트릭 조회
   */
  async getAggregatedSystemMetrics(
    service: string,
    windowMinutes: number = 5,
    bucketSize: "1min" | "5min" = "1min",
    limit: number = 100,
  ) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);
    const results = await this.systemMetricsRepo.getAggregatedMetrics(
      service,
      startTime,
      endTime,
      bucketSize,
    );
    return results.slice(0, limit);
  }

  // ========== 공통 조회 ==========

  /**
   * 활성 서비스 목록 조회 (API + System 통합)
   */
  async getActiveServices(): Promise<{
    api: string[];
    system: string[];
    all: string[];
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 병렬로 조회
    const [apiMetrics, systemServices] = await Promise.all([
      this.apiMetricsRepo.getRecentMetrics("", 1000),
      this.systemMetricsRepo.getActiveServices(oneHourAgo),
    ]);

    const apiServices = Array.from(new Set(apiMetrics.map((m) => m.service)));
    const allServices = Array.from(
      new Set([...apiServices, ...systemServices]),
    );

    return {
      api: apiServices,
      system: systemServices,
      all: allServices,
    };
  }
}
