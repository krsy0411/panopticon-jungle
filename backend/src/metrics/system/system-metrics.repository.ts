/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { CreateSystemMetricDto } from "./dto/create-system-metric.dto";

export interface SystemMetricRecord {
  time: Date;
  service: string;
  pod_name: string;
  node_name?: string;
  namespace?: string;
  cpu_usage_percent?: number;
  memory_usage_bytes?: number;
  disk_usage_percent?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  metadata?: Record<string, unknown>;
}

export interface AggregatedSystemMetric {
  bucket: Date;
  service: string;
  pod_name: string;
  node_name?: string;
  avg_cpu_percent?: number;
  max_cpu_percent?: number;
  min_cpu_percent?: number;
  avg_cpu_cores?: number;
  avg_memory_percent?: number;
  max_memory_percent?: number;
  avg_memory_bytes?: number;
  avg_disk_percent?: number;
  max_disk_percent?: number;
  total_network_rx_bytes?: number;
  total_network_tx_bytes?: number;
  sample_count: number;
}

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
      port: parseInt(process.env.TIMESCALE_PORT || "5432"),
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
      new Date(createMetricDto.timestamp || Date.now()),
      createMetricDto.service,
      createMetricDto.podName,
      createMetricDto.nodeName || null,
      createMetricDto.namespace || null,
      createMetricDto.cpu ?? null,
      createMetricDto.memory ?? null,
      createMetricDto.disk ?? null,
      createMetricDto.networkIn ?? null,
      createMetricDto.networkOut ?? null,
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
   * 배치 저장 (여러 시스템 메트릭 한 번에 저장)
   */
  async saveBatch(metrics: CreateSystemMetricDto[]): Promise<void> {
    if (metrics.length === 0) return;

    const client: PoolClient = await this.pool.connect();

    try {
      await client.query("BEGIN");

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

      for (const metric of metrics) {
        const values = [
          new Date(metric.timestamp || Date.now()),
          metric.service,
          metric.podName,
          metric.nodeName || null,
          metric.namespace || null,
          metric.cpu ?? null,
          metric.memory ?? null,
          metric.disk ?? null,
          metric.networkIn ?? null,
          metric.networkOut ?? null,
          metric.metadata ? JSON.stringify(metric.metadata) : null,
        ];

        await client.query(query, values);
      }

      await client.query("COMMIT");
      this.logger.debug(
        `Saved ${metrics.length} system metrics to TimescaleDB`,
      );
    } catch (error) {
      await client.query("ROLLBACK");
      this.logger.error(
        "Failed to save batch system metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 최근 시스템 메트릭 조회
   */
  async getRecentMetrics(
    service: string,
    limit: number = 100,
  ): Promise<SystemMetricRecord[]> {
    const query = `
      SELECT
        time, service, pod_name, node_name, namespace,
        cpu_usage_percent, memory_usage_bytes, disk_usage_percent,
        network_rx_bytes, network_tx_bytes,
        metadata
      FROM system_metrics
      WHERE service = $1
      ORDER BY time DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query<SystemMetricRecord>(query, [
        service,
        limit,
      ]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        "Failed to query system metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Pod별 최근 메트릭 조회
   */
  async getRecentMetricsByPod(
    podName: string,
    limit: number = 100,
  ): Promise<SystemMetricRecord[]> {
    const query = `
      SELECT
        time, service, pod_name, node_name, namespace,
        cpu_usage_percent, memory_usage_bytes, disk_usage_percent,
        network_rx_bytes, network_tx_bytes,
        metadata
      FROM system_metrics
      WHERE pod_name = $1
      ORDER BY time DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query<SystemMetricRecord>(query, [
        podName,
        limit,
      ]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        "Failed to query system metrics by pod",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 시간 범위별 집계 조회 (연속 집계 뷰 활용)
   */
  async getAggregatedMetrics(
    service: string,
    startTime: Date,
    endTime: Date,
    bucketSize: "1min" | "5min" = "1min",
  ): Promise<AggregatedSystemMetric[]> {
    const viewName =
      bucketSize === "1min" ? "system_metrics_1min" : "system_metrics_5min";

    const query = `
      SELECT
        bucket,
        service,
        pod_name,
        node_name,
        namespace,
        avg_cpu_usage_percent,
        max_cpu_usage_percent,
        avg_cpu_cores_used,
        avg_memory_usage_bytes,
        max_memory_usage_bytes,
        avg_memory_usage_percent,
        avg_disk_usage_percent,
        total_network_rx_bytes,
        total_network_tx_bytes,
        sample_count
      FROM ${viewName}
      WHERE service = $1
        AND bucket >= $2
        AND bucket <= $3
      ORDER BY bucket DESC
    `;

    try {
      const result = await this.pool.query<AggregatedSystemMetric>(query, [
        service,
        startTime,
        endTime,
      ]);
      return result.rows;
    } catch (error) {
      this.logger.error(
        "Failed to query aggregated system metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 활성 서비스 목록 조회
   */
  async getActiveServices(since: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT service
      FROM system_metrics
      WHERE time >= $1
      ORDER BY service
    `;

    try {
      const result = await this.pool.query<{ service: string }>(query, [since]);
      return result.rows.map((row) => row.service);
    } catch (error) {
      this.logger.error(
        "Failed to query active services",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 시계열 데이터 조회 (대시보드용)
   * - CPU와 메모리 사용률을 시간대별로 집계
   */
  async getTimeseriesData(
    startTime: Date,
    endTime: Date,
    intervalMinutes: number,
  ): Promise<
    Array<{
      timestamp: Date;
      cpu: number;
      memory: number;
    }>
  > {
    const query = `
      WITH time_buckets AS (
        SELECT
          time_bucket($1::interval, time) as bucket,
          AVG(cpu_usage_percent) as avg_cpu,
          AVG(memory_usage_bytes) as avg_memory_bytes
        FROM system_metrics
        WHERE time >= $2 AND time <= $3
        GROUP BY bucket
        ORDER BY bucket
      )
      SELECT
        bucket as timestamp,
        COALESCE(ROUND(avg_cpu::numeric, 2), 0) as cpu,
        COALESCE(ROUND((avg_memory_bytes / (1024.0 * 1024.0 * 1024.0))::numeric, 2), 0) as memory
      FROM time_buckets
    `;

    try {
      const result = await this.pool.query<{
        timestamp: Date;
        cpu: string;
        memory: string;
      }>(query, [`${intervalMinutes} minutes`, startTime, endTime]);

      return result.rows.map((row) => ({
        timestamp: row.timestamp,
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
