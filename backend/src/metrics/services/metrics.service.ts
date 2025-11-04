/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from "@nestjs/common";
import { ApiMetricsRepository } from "../api/api-metrics.repository";
import { SystemMetricsRepository } from "../system/system-metrics.repository";

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

  // ========== 대시보드 조회 ==========

  /**
   * 대시보드 상단 메트릭 요약 조회
   * 최근 5분간 데이터 기준
   */
  async getMetricsSummary(): Promise<{
    status_2xx: number;
    status_4xx: number;
    status_5xx: number;
    request_per_min: number;
    p95_latency: number;
  }> {
    return await this.apiMetricsRepo.getMetricsSummary();
  }

  /**
   * 대시보드 하단 시계열 데이터 조회
   * @param range 조회 기간 (예: 12h, 24h, 7d)
   * @param interval 데이터 간격 (예: 1m, 5m, 1h)
   */
  async getMetricsTimeseries(
    range: string,
    interval: string,
  ): Promise<{
    range: string;
    interval: string;
    data: Array<{
      timestamp: string;
      requests: number;
      errors: number;
      cpu: number;
      memory: number;
    }>;
  }> {
    // range를 시간(분)으로 변환
    const rangeMinutes = this.parseRangeToMinutes(range);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - rangeMinutes * 60 * 1000);

    // interval을 분 단위로 변환
    const intervalMinutes = this.parseIntervalToMinutes(interval);

    // 병렬로 API 메트릭과 시스템 메트릭 조회
    const [apiData, systemData] = await Promise.all([
      this.apiMetricsRepo.getTimeseriesData(
        startTime,
        endTime,
        intervalMinutes,
      ),
      this.systemMetricsRepo.getTimeseriesData(
        startTime,
        endTime,
        intervalMinutes,
      ),
    ]);

    // 데이터 병합 (timestamp 기준)
    const mergedData = this.mergeTimeseriesData(
      apiData as Array<{ timestamp: Date; requests: number; errors: number }>,
      systemData as Array<{ timestamp: Date; cpu: number; memory: number }>,
    );

    return {
      range,
      interval,
      data: mergedData,
    };
  }

  /**
   * range 문자열을 분 단위로 변환
   * 예: "12h" -> 720, "24h" -> 1440, "7d" -> 10080
   */
  private parseRangeToMinutes(range: string): number {
    const value = parseInt(range.slice(0, -1));
    const unit = range.slice(-1);

    switch (unit) {
      case "h":
        return value * 60;
      case "d":
        return value * 24 * 60;
      case "m":
        return value;
      default:
        return 720; // 기본값: 12시간
    }
  }

  /**
   * interval 문자열을 분 단위로 변환
   * 예: "1m" -> 1, "5m" -> 5, "1h" -> 60
   */
  private parseIntervalToMinutes(interval: string): number {
    const value = parseInt(interval.slice(0, -1));
    const unit = interval.slice(-1);

    switch (unit) {
      case "m":
        return value;
      case "h":
        return value * 60;
      default:
        return 5; // 기본값: 5분
    }
  }

  /**
   * API 메트릭과 시스템 메트릭을 timestamp 기준으로 병합
   */
  private mergeTimeseriesData(
    apiData: Array<{
      timestamp: Date;
      requests: number;
      errors: number;
    }>,
    systemData: Array<{
      timestamp: Date;
      cpu: number;
      memory: number;
    }>,
  ): Array<{
    timestamp: string;
    requests: number;
    errors: number;
    cpu: number;
    memory: number;
  }> {
    const dataMap = new Map<
      string,
      {
        timestamp: string;
        requests: number;
        errors: number;
        cpu: number;
        memory: number;
      }
    >();

    // API 데이터 추가
    for (const item of apiData) {
      const timestamp = item.timestamp.toISOString();
      dataMap.set(timestamp, {
        timestamp,
        requests: item.requests,
        errors: item.errors,
        cpu: 0,
        memory: 0,
      });
    }

    // 시스템 데이터 병합
    for (const item of systemData) {
      const timestamp = item.timestamp.toISOString();
      const existing = dataMap.get(timestamp);
      if (existing) {
        existing.cpu = item.cpu;
        existing.memory = item.memory;
      } else {
        dataMap.set(timestamp, {
          timestamp,
          requests: 0,
          errors: 0,
          cpu: item.cpu,
          memory: item.memory,
        });
      }
    }

    // 시간순 정렬
    return Array.from(dataMap.values()).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }
}
