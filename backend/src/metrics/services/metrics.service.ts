import { Injectable } from "@nestjs/common";
import { SystemMetricsRepository } from "../system/system-metrics.repository";
import { HttpMetricsRepository } from "../http/http-metrics.repository";

/**
 * 메트릭 조회 서비스
 * 시계열 메트릭 조회 기능 제공
 * Repository의 데이터를 병합하여 비즈니스 로직 수행
 */
@Injectable()
export class MetricsService {
  constructor(
    private readonly systemMetricsRepo: SystemMetricsRepository,
    private readonly httpMetricsRepo: HttpMetricsRepository,
  ) {}

  /**
   * 시계열 데이터 조회
   * Repository에서 개별 데이터를 조회하여 Service 레이어에서 병합
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
    const rangeMinutes = this.parseRangeToMinutes(range);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - rangeMinutes * 60 * 1000);
    const intervalMinutes = this.parseIntervalToMinutes(interval);

    // Repository에서 각각 데이터 조회 (단순 쿼리만)
    const [systemMetrics, httpMetrics] = await Promise.all([
      this.systemMetricsRepo.findAggregatedByTimeRange(
        startTime,
        endTime,
        intervalMinutes,
      ),
      this.httpMetricsRepo.findAggregatedByTimeRange(
        startTime,
        endTime,
        intervalMinutes,
      ),
    ]);

    // Service 레이어에서 비즈니스 로직: 두 데이터 병합
    const mergedData = this.mergeMetrics(systemMetrics, httpMetrics);

    return {
      range,
      interval,
      data: mergedData,
    };
  }

  /**
   * 시스템 메트릭과 HTTP 메트릭을 병합 (비즈니스 로직)
   * FULL OUTER JOIN과 동일한 결과 생성
   */
  private mergeMetrics(
    systemMetrics: Array<{
      bucket: Date;
      avgCpu: number;
      avgMemoryBytes: number;
    }>,
    httpMetrics: Array<{
      bucket: Date;
      totalRequests: number;
      avgErrorRate: number;
    }>,
  ): Array<{
    timestamp: string;
    requests: number;
    errors: number;
    cpu: number;
    memory: number;
  }> {
    // 모든 고유한 bucket(timestamp)을 수집
    const bucketMap = new Map<
      number,
      {
        timestamp: Date;
        requests: number;
        errors: number;
        cpu: number;
        memory: number;
      }
    >();

    // 시스템 메트릭 데이터 추가
    for (const metric of systemMetrics) {
      const time = metric.bucket.getTime();
      bucketMap.set(time, {
        timestamp: metric.bucket,
        requests: 0,
        errors: 0,
        cpu: Math.round(metric.avgCpu * 100) / 100, // 소수점 2자리
        memory:
          Math.round((metric.avgMemoryBytes / (1024 * 1024 * 1024)) * 100) /
          100, // GB 단위
      });
    }

    // HTTP 메트릭 데이터 병합
    for (const metric of httpMetrics) {
      const time = metric.bucket.getTime();
      const existing = bucketMap.get(time);

      if (existing) {
        existing.requests = metric.totalRequests;
        existing.errors = Math.round(metric.avgErrorRate * 100) / 100; // 소수점 2자리
      } else {
        bucketMap.set(time, {
          timestamp: metric.bucket,
          requests: metric.totalRequests,
          errors: Math.round(metric.avgErrorRate * 100) / 100,
          cpu: 0,
          memory: 0,
        });
      }
    }

    // 시간 순으로 정렬하여 반환
    return Array.from(bucketMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((item) => ({
        timestamp: item.timestamp.toISOString(),
        requests: item.requests,
        errors: item.errors,
        cpu: item.cpu,
        memory: item.memory,
      }));
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
}
