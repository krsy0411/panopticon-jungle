import { Injectable, Logger } from "@nestjs/common";
import { TimescaleConnectionService } from "../common/timescale-connection.service";
import { CreateHttpMetricDto } from "./dto/create-http-metric.dto";

/**
 * HTTP 메트릭 저장소
 * TimescaleDB에 HTTP 로그 집계 데이터 저장
 */
@Injectable()
export class HttpMetricsRepository {
  private readonly logger = new Logger(HttpMetricsRepository.name);

  constructor(private readonly connectionService: TimescaleConnectionService) {}

  /**
   * 단일 HTTP 메트릭 저장 (UPSERT)
   */
  async save(createMetricDto: CreateHttpMetricDto): Promise<void> {
    const query = `
      INSERT INTO http_metrics (
        timestamp, service, requests, errors
      ) VALUES (
        $1, $2, $3, $4
      )
      ON CONFLICT (timestamp, service) DO UPDATE SET
        requests = http_metrics.requests + EXCLUDED.requests,
        errors = (
          (http_metrics.requests * http_metrics.errors + EXCLUDED.requests * EXCLUDED.errors)
          / NULLIF(http_metrics.requests + EXCLUDED.requests, 0)
        )
    `;

    const values = [
      new Date(createMetricDto.timestamp ?? Date.now()),
      createMetricDto.service,
      createMetricDto.requests,
      createMetricDto.errors,
    ];

    try {
      await this.connectionService.getPool().query(query, values);
    } catch (error) {
      this.logger.error(
        "Failed to save HTTP metric to TimescaleDB",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * HTTP 메트릭 집계 조회 (단순 쿼리만 수행)
   * Service 레이어에서 병합하여 사용
   */
  async findAggregatedByTimeRange(
    startTime: Date,
    endTime: Date,
    intervalMinutes: number,
  ): Promise<
    Array<{
      bucket: Date;
      totalRequests: number;
      avgErrorRate: number;
    }>
  > {
    const query = `
      SELECT
        time_bucket($1::interval, timestamp) as bucket,
        SUM(requests) as total_requests,
        SUM(requests * errors) / NULLIF(SUM(requests), 0) as avg_error_rate
      FROM http_metrics
      WHERE timestamp >= $2 AND timestamp <= $3
      GROUP BY bucket
      ORDER BY bucket
    `;

    try {
      const result = await this.connectionService.getPool().query<{
        bucket: Date;
        total_requests: string;
        avg_error_rate: string;
      }>(query, [`${intervalMinutes} minutes`, startTime, endTime]);

      return result.rows.map((row) => ({
        bucket: row.bucket,
        totalRequests: Number(row.total_requests) || 0,
        avgErrorRate: Number(row.avg_error_rate) || 0,
      }));
    } catch (error) {
      this.logger.error(
        "Failed to query aggregated HTTP metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
