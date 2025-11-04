/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { CreateSystemMetricDto } from "./dto/create-system-metric.dto";

/**
 * 시스템 메트릭 저장소
 * TimescaleDB에 CPU, 메모리, 디스크, 네트워크 등 인프라 메트릭 저장
 */
@Injectable()
export class SystemMetricsRepository implements OnModuleInit {
  private readonly logger = new Logger(SystemMetricsRepository.name);
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
      this.logger.log("TimescaleDB connected (SystemMetrics)");
    });

    this.pool.on("error", (err) => {
      this.logger.error(
        "TimescaleDB connection error (SystemMetrics)",
        err instanceof Error ? err.stack : String(err),
      );
    });

    // 연결 테스트
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      this.logger.log(
        `TimescaleDB connection verified (SystemMetrics): ${process.env.TIMESCALE_HOST}:${process.env.TIMESCALE_PORT}`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to connect to TimescaleDB on initialization (SystemMetrics)",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 단일 시스템 메트릭 저장
   */
  async save(createMetricDto: CreateSystemMetricDto): Promise<void> {
    const query = `
      INSERT INTO system_metrics (
        time, service, pod_name, node_name, namespace,
        cpu_usage_percent, memory_usage_bytes, disk_usage_percent,
        network_rx_bytes, network_tx_bytes,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10,
        $11
      )
      ON CONFLICT (time, service, pod_name) DO UPDATE SET
        cpu_usage_percent = EXCLUDED.cpu_usage_percent,
        memory_usage_bytes = EXCLUDED.memory_usage_bytes,
        disk_usage_percent = EXCLUDED.disk_usage_percent,
        network_rx_bytes = EXCLUDED.network_rx_bytes,
        network_tx_bytes = EXCLUDED.network_tx_bytes,
        metadata = EXCLUDED.metadata
    `;

    const values = [
      new Date(createMetricDto.time || Date.now()),
      createMetricDto.service,
      createMetricDto.podName,
      createMetricDto.nodeName || null,
      createMetricDto.namespace || null,
      createMetricDto.cpuUsagePercent ?? null,
      createMetricDto.memoryUsageBytes ?? null,
      createMetricDto.diskUsagePercent ?? null,
      createMetricDto.networkRxBytes ?? null,
      createMetricDto.networkTxBytes ?? null,
      createMetricDto.metadata
        ? JSON.stringify(createMetricDto.metadata)
        : null,
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      this.logger.error(
        "Failed to save system metric to TimescaleDB",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 시계열 데이터 조회 (대시보드용)
   * - system_metrics와 http_metrics를 LEFT JOIN하여 CPU, 메모리, 요청 수, 에러율 조회
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
      cpu: number;
      memory: number;
    }>
  > {
    const query = `
      WITH system_buckets AS (
        SELECT
          time_bucket($1::interval, time) as bucket,
          AVG(cpu_usage_percent) as avg_cpu,
          AVG(memory_usage_bytes) as avg_memory_bytes
        FROM system_metrics
        WHERE time >= $2 AND time <= $3
        GROUP BY bucket
      ),
      http_buckets AS (
        SELECT
          time_bucket($1::interval, time) as bucket,
          SUM(requests) as total_requests,
          -- 가중 평균으로 에러율 계산
          SUM(requests * errors) / NULLIF(SUM(requests), 0) as avg_error_rate
        FROM http_metrics
        WHERE time >= $2 AND time <= $3
        GROUP BY bucket
      )
      SELECT
        COALESCE(s.bucket, h.bucket) as timestamp,
        COALESCE(h.total_requests, 0) as requests,
        COALESCE(ROUND(h.avg_error_rate::numeric, 2), 0) as errors,
        COALESCE(ROUND(s.avg_cpu::numeric, 2), 0) as cpu,
        COALESCE(ROUND((s.avg_memory_bytes / (1024.0 * 1024.0 * 1024.0))::numeric, 2), 0) as memory
      FROM system_buckets s
      FULL OUTER JOIN http_buckets h ON s.bucket = h.bucket
      ORDER BY timestamp
    `;

    try {
      const result = await this.pool.query<{
        timestamp: Date;
        requests: string;
        errors: string;
        cpu: string;
        memory: string;
      }>(query, [`${intervalMinutes} minutes`, startTime, endTime]);

      return result.rows.map((row) => ({
        timestamp: row.timestamp,
        requests: Number(row.requests) || 0,
        errors: Number(row.errors) || 0,
        cpu: Number(row.cpu) || 0,
        memory: Number(row.memory) || 0,
      }));
    } catch (error) {
      this.logger.error(
        "Failed to query system timeseries data",
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
    this.logger.log("TimescaleDB connection pool closed (SystemMetrics)");
  }
}
