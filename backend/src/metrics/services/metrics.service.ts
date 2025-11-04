/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from "@nestjs/common";
import { SystemMetricsRepository } from "../system/system-metrics.repository";

/**
 * 메트릭 조회 서비스
 * 시계열 메트릭 조회 기능 제공
 */
@Injectable()
export class MetricsService {
  constructor(private readonly systemMetricsRepo: SystemMetricsRepository) {}

  /**
   * 시계열 데이터 조회
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

    const timeseriesData = await this.systemMetricsRepo.getTimeseriesData(
      startTime,
      endTime,
      intervalMinutes,
    );

    const data = timeseriesData.map((item) => ({
      timestamp: item.timestamp.toISOString(),
      requests: item.requests,
      errors: item.errors,
      cpu: item.cpu,
      memory: item.memory,
    }));

    return {
      range,
      interval,
      data,
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
}
