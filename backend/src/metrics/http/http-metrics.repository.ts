/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";

/**
 * HTTP 메트릭 저장 DTO
 */
export interface CreateHttpMetricDto {
  time: number; // Unix timestamp
  service: string;
  requests: number;
  errors: number; // 에러율 (%)
}

/**
 * HTTP 메트릭 레코드
 */
export interface HttpMetricRecord {
  time: Date;
  service: string;
  requests: number;
  errors: number;
}

/**
 * HTTP 메트릭 저장소
 * TimescaleDB에 HTTP 로그 집계 데이터 저장
 */
@Injectable()
export class HttpMetricsRepository implements OnModuleInit {
  private readonly logger = new Logger(HttpMetricsRepository.name);
  private pool: Pool;

  async onModuleInit() {
    // PostgreSQL/TimescaleDB 연결 설정
    this.pool = new Pool({
      host: process.env.TIMESCALE_HOST || "localhost",
      port: parseInt(process.env.TIMESCALE_PORT || "5433"),
      database: process.env.TIMESCALE_DATABASE || "panopticon",
      user: process.env.TIMESCALE_USER || "admin",
      password: process.env.TIMESCALE_PASSWORD || "admin123",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("connect", () => {
      this.logger.log("TimescaleDB connected (HttpMetrics)");
    });

    this.pool.on("error", (err: Error) => {
      this.logger.error(
        "TimescaleDB connection error (HttpMetrics)",
        err.stack,
      );
    });

    // 연결 테스트
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      this.logger.log(
        `TimescaleDB connection verified (HttpMetrics): ${process.env.TIMESCALE_HOST}:${process.env.TIMESCALE_PORT}`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to connect to TimescaleDB on initialization (HttpMetrics)",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 단일 HTTP 메트릭 저장 (UPSERT)
   */
  async save(createMetricDto: CreateHttpMetricDto): Promise<void> {
    const query = `
      INSERT INTO http_metrics (
        time, service, requests, errors
      ) VALUES (
        $1, $2, $3, $4
      )
      ON CONFLICT (time, service) DO UPDATE SET
        requests = http_metrics.requests + EXCLUDED.requests,
        errors = (
          (http_metrics.requests * http_metrics.errors + EXCLUDED.requests * EXCLUDED.errors)
          / NULLIF(http_metrics.requests + EXCLUDED.requests, 0)
        )
    `;

    const values = [
      new Date(createMetricDto.time),
      createMetricDto.service,
      createMetricDto.requests,
      createMetricDto.errors,
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      this.logger.error(
        "Failed to save HTTP metric to TimescaleDB",
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
    this.logger.log("TimescaleDB connection pool closed (HttpMetrics)");
  }
}
