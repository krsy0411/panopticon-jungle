/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { CreateApiMetricDto } from "./dto/create-api-metric.dto";

export interface ApiMetricRecord {
  time: Date;
  service: string;
  endpoint?: string;
  method?: string;
  latency_ms?: number;
  status_code?: number;
  error_count: number;
  request_count: number;
  metadata?: Record<string, unknown>;
}

/**
 * API 메트릭 저장소
 * HTTP API 요청/응답 메트릭을 TimescaleDB에 저장
 */
@Injectable()
export class ApiMetricsRepository implements OnModuleInit {
  private readonly logger = new Logger(ApiMetricsRepository.name);
  private pool: Pool;

  async onModuleInit() {
    // PostgreSQL/TimescaleDB 연결 설정
    this.pool = new Pool({
      host: process.env.TIMESCALE_HOST || "localhost",
      port: parseInt(process.env.TIMESCALE_PORT || "5432"),
      database: process.env.TIMESCALE_DATABASE || "panopticon",
      user: process.env.TIMESCALE_USER || "admin",
      password: process.env.TIMESCALE_PASSWORD || "admin123",
      max: 20, // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("connect", () => {
      this.logger.log("TimescaleDB connected successfully");
    });

    this.pool.on("error", (err) => {
      this.logger.error(
        "TimescaleDB connection error",
        err instanceof Error ? err.stack : String(err),
      );
    });

    // 연결 테스트
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      this.logger.log(
        `TimescaleDB connection verified: ${process.env.TIMESCALE_HOST}:${process.env.TIMESCALE_PORT}`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to connect to TimescaleDB on initialization",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 단일 메트릭 저장
   */
  async save(createMetricDto: CreateApiMetricDto): Promise<void> {
    const query = `
      INSERT INTO api_metrics (
        time, service, endpoint, method, latency_ms, status_code,
        error_count, request_count
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
    `;

    const values = [
      new Date(createMetricDto.timestamp || new Date()),
      createMetricDto.service,
      createMetricDto.endpoint || null,
      createMetricDto.method || null,
      createMetricDto.latency || null,
      createMetricDto.status || null,
      createMetricDto.status && createMetricDto.status >= 400 ? 1 : 0,
      1,
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      this.logger.error(
        "Failed to save metric to TimescaleDB",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 배치 저장 (여러 메트릭 한 번에 저장)
   */
  async saveBatch(metrics: CreateApiMetricDto[]): Promise<void> {
    if (metrics.length === 0) return;

    const client: PoolClient = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const query = `
        INSERT INTO api_metrics (
          time, service, endpoint, method, latency_ms, status_code,
          error_count, request_count
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `;

      for (const metric of metrics) {
        const values = [
          new Date(metric.timestamp || new Date()),
          metric.service,
          metric.endpoint || null,
          metric.method || null,
          metric.latency || null,
          metric.status || null,
          metric.status && metric.status >= 400 ? 1 : 0,
          1,
        ];

        await client.query(query, values);
      }

      await client.query("COMMIT");
      this.logger.debug(`Saved ${metrics.length} metrics to TimescaleDB`);
    } catch (error) {
      await client.query("ROLLBACK");
      this.logger.error(
        "Failed to save batch metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 최근 메트릭 조회 (테스트용)
   */
  async getRecentMetrics(
    service: string,
    limit: number = 100,
  ): Promise<ApiMetricRecord[]> {
    const query = `
      SELECT time, service, endpoint, method, latency_ms, status_code,
             error_count, request_count
      FROM api_metrics
      WHERE service = $1
      ORDER BY time DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query<ApiMetricRecord>(query, [
        service,
        limit,
      ]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        "Failed to query metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 시간 범위별 집계 조회 (연속 집계 뷰 활용)
   */
  async getAggregatedMetrics(service: string, startTime: Date, endTime: Date) {
    const query = `
      SELECT
        bucket,
        service,
        endpoint,
        method,
        request_count,
        avg_latency_ms,
        max_latency_ms,
        min_latency_ms,
        error_count,
        error_rate
      FROM api_metrics_1min
      WHERE service = $1
        AND bucket >= $2
        AND bucket <= $3
      ORDER BY bucket DESC
    `;

    try {
      const result = await this.pool.query(query, [
        service,
        startTime,
        endTime,
      ]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        "Failed to query aggregated metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 대시보드 메트릭 요약 조회 (최근 5분)
   * - 성공/에러 요청 수
   * - 분당 요청 수
   * - P95 레이턴시
   */
  async getMetricsSummary(): Promise<{
    status_2xx: number;
    status_4xx: number;
    status_5xx: number;
    request_per_min: number;
    p95_latency: number;
  }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const query = `
      WITH recent_metrics AS (
        SELECT
          status_code,
          latency_ms,
          request_count
        FROM api_metrics
        WHERE time >= $1
      ),
      status_counts AS (
        SELECT
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN request_count ELSE 0 END) as status_2xx,
          SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN request_count ELSE 0 END) as status_4xx,
          SUM(CASE WHEN status_code >= 500 THEN request_count ELSE 0 END) as status_5xx,
          SUM(request_count) as total_requests
        FROM recent_metrics
      ),
      latency_stats AS (
        SELECT
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
        FROM recent_metrics
        WHERE latency_ms IS NOT NULL
      )
      SELECT
        COALESCE(sc.status_2xx, 0) as status_2xx,
        COALESCE(sc.status_4xx, 0) as status_4xx,
        COALESCE(sc.status_5xx, 0) as status_5xx,
        COALESCE(sc.total_requests / 5.0, 0) as request_per_min,
        COALESCE(ls.p95_latency, 0) as p95_latency
      FROM status_counts sc
      CROSS JOIN latency_stats ls
    `;

    try {
      const result = await this.pool.query<{
        status_2xx: string;
        status_4xx: string;
        status_5xx: string;
        request_per_min: string;
        p95_latency: string;
      }>(query, [fiveMinutesAgo]);

      if (result.rows.length === 0) {
        return {
          status_2xx: 0,
          status_4xx: 0,
          status_5xx: 0,
          request_per_min: 0,
          p95_latency: 0,
        };
      }

      const row = result.rows[0];
      const toNumber = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      return {
        status_2xx: Math.round(toNumber(row.status_2xx)),
        status_4xx: Math.round(toNumber(row.status_4xx)),
        status_5xx: Math.round(toNumber(row.status_5xx)),
        request_per_min: Math.round(toNumber(row.request_per_min)),
        p95_latency: Math.round(toNumber(row.p95_latency)),
      };
    } catch (error) {
      this.logger.error(
        "Failed to query metrics summary",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 시계열 데이터 조회 (대시보드용)
   * - 요청 수와 에러율을 시간대별로 집계
   */
  async getTimeseriesData(
    startTime: Date,
    endTime: Date,
    intervalMinutes: number,
  ): Promise<
    Array<{
      timestamp: Date;
      requests: number;
      errors: number;
    }>
  > {
    const query = `
      WITH time_buckets AS (
        SELECT
          time_bucket($1::interval, time) as bucket,
          SUM(request_count) as total_requests,
          SUM(error_count) as total_errors
        FROM api_metrics
        WHERE time >= $2 AND time <= $3
        GROUP BY bucket
        ORDER BY bucket
      )
      SELECT
        bucket as timestamp,
        COALESCE(total_requests, 0) as requests,
        CASE
          WHEN total_requests > 0 THEN ROUND((total_errors::numeric / total_requests::numeric * 100)::numeric, 2)
          ELSE 0
        END as errors
      FROM time_buckets
    `;

    try {
      const result = await this.pool.query<{
        timestamp: Date;
        requests: string;
        errors: string;
      }>(query, [`${intervalMinutes} minutes`, startTime, endTime]);

      return result.rows.map((row) => ({
        timestamp: row.timestamp,
        requests: Number(row.requests) || 0,
        errors: Number(row.errors) || 0,
      }));
    } catch (error) {
      this.logger.error(
        "Failed to query timeseries data",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 연결 종료
   */
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log("TimescaleDB connection pool closed");
  }
}
