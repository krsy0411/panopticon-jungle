import { Injectable, Logger } from "@nestjs/common";
import {
  HttpMetricsRepository,
  type CreateHttpMetricDto,
} from "../http/http-metrics.repository";

/**
 * HTTP 로그를 실시간으로 집계하여 TimescaleDB에 저장하는 서비스
 * 각 로그를 받을 때마다 즉시 DB에 UPSERT
 */
@Injectable()
export class HttpLogAggregatorService {
  private readonly logger = new Logger(HttpLogAggregatorService.name);

  constructor(private readonly httpMetricsRepo: HttpMetricsRepository) {}

  /**
   * HTTP 로그 추가 (실시간 저장)
   * @param service 서비스명
   * @param statusCode HTTP 상태 코드
   * @param timestamp 로그 발생 시각
   */
  async addLog(
    service: string,
    statusCode: number,
    timestamp: number,
  ): Promise<void> {
    // 1분 단위로 타임스탬프 반올림
    const bucketTimestamp = this.getBucketTimestamp(timestamp);

    // 에러 판단 (4xx, 5xx)
    const isError = statusCode >= 400;

    // 에러율 계산: 이 요청이 에러면 100%, 아니면 0%
    // DB에서 UPSERT 시 가중 평균으로 계산됨
    const errorRate = isError ? 100 : 0;

    const metric: CreateHttpMetricDto = {
      time: bucketTimestamp,
      service,
      requests: 1, // 1개의 요청
      errors: errorRate,
    };

    try {
      await this.httpMetricsRepo.save(metric);
      this.logger.debug(
        `HTTP metric saved: ${service} @ ${new Date(bucketTimestamp).toISOString()} - ` +
          `Status: ${statusCode}, Error: ${isError}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save HTTP metric for ${service}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 1분 단위로 타임스탬프 반올림
   * 예: 2025-11-03T09:00:45Z -> 2025-11-03T09:00:00Z
   */
  private getBucketTimestamp(timestamp: number): number {
    return Math.floor(timestamp / (60 * 1000)) * (60 * 1000);
  }
}
