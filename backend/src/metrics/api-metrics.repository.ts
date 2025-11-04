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
      this.logger.error("TimescaleDB connection error", err);
    });

    // 연결 테스트
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      this.logger.log(`TimescaleDB connection verified: ${process.env.TIMESCALE_HOST}:${process.env.TIMESCALE_PORT}`);
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
   * 연결 종료
   */
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log("TimescaleDB connection pool closed");
  }
}
