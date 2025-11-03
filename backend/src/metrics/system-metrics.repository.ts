/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import {
  SystemMetricData,
  SystemMetricRecord,
  AggregatedSystemMetric,
} from "./interfaces/system-metric.interface";

/**
 * 시스템 메트릭 저장소
 * TimescaleDB에 CPU, 메모리, 디스크, 네트워크 등 인프라 메트릭 저장
 */
@Injectable()
export class SystemMetricsRepository implements OnModuleInit {
  private readonly logger = new Logger(SystemMetricsRepository.name);
  private pool: Pool;

  onModuleInit() {
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
      this.logger.error("TimescaleDB connection error (SystemMetrics)", err);
    });
  }

  /**
   * 단일 시스템 메트릭 저장
   */
  async save(metric: SystemMetricData): Promise<void> {
    const query = `
      INSERT INTO system_metrics (
        time, service, pod_name, node_name, namespace,
        cpu_usage_percent, cpu_cores_used,
        memory_usage_bytes, memory_usage_percent, memory_limit_bytes,
        disk_usage_percent, disk_usage_bytes, disk_io_read_bytes, disk_io_write_bytes,
        network_rx_bytes, network_tx_bytes, network_rx_packets, network_tx_packets,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19
      )
      ON CONFLICT (time, service, pod_name) DO UPDATE SET
        cpu_usage_percent = EXCLUDED.cpu_usage_percent,
        cpu_cores_used = EXCLUDED.cpu_cores_used,
        memory_usage_bytes = EXCLUDED.memory_usage_bytes,
        memory_usage_percent = EXCLUDED.memory_usage_percent,
        memory_limit_bytes = EXCLUDED.memory_limit_bytes,
        disk_usage_percent = EXCLUDED.disk_usage_percent,
        disk_usage_bytes = EXCLUDED.disk_usage_bytes,
        disk_io_read_bytes = EXCLUDED.disk_io_read_bytes,
        disk_io_write_bytes = EXCLUDED.disk_io_write_bytes,
        network_rx_bytes = EXCLUDED.network_rx_bytes,
        network_tx_bytes = EXCLUDED.network_tx_bytes,
        network_rx_packets = EXCLUDED.network_rx_packets,
        network_tx_packets = EXCLUDED.network_tx_packets,
        metadata = EXCLUDED.metadata
    `;

    const values = [
      new Date(metric.timestamp),
      metric.service,
      metric.podName || null,
      metric.nodeName || null,
      metric.namespace || null,
      // CPU
      metric.cpuUsagePercent ?? null,
      metric.cpuCoresUsed ?? null,
      // 메모리
      metric.memoryUsageBytes ?? null,
      metric.memoryUsagePercent ?? null,
      metric.memoryLimitBytes ?? null,
      // 디스크
      metric.diskUsagePercent ?? null,
      metric.diskUsageBytes ?? null,
      metric.diskIoReadBytes ?? null,
      metric.diskIoWriteBytes ?? null,
      // 네트워크
      metric.networkRxBytes ?? null,
      metric.networkTxBytes ?? null,
      metric.networkRxPackets ?? null,
      metric.networkTxPackets ?? null,
      // 메타데이터
      metric.metadata ? JSON.stringify(metric.metadata) : null,
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
  async saveBatch(metrics: SystemMetricData[]): Promise<void> {
    if (metrics.length === 0) return;

    const client: PoolClient = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const query = `
        INSERT INTO system_metrics (
          time, service, pod_name, node_name, namespace,
          cpu_usage_percent, cpu_cores_used,
          memory_usage_bytes, memory_usage_percent, memory_limit_bytes,
          disk_usage_percent, disk_usage_bytes, disk_io_read_bytes, disk_io_write_bytes,
          network_rx_bytes, network_tx_bytes, network_rx_packets, network_tx_packets,
          metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19
        )
        ON CONFLICT (time, service, pod_name) DO UPDATE SET
          cpu_usage_percent = EXCLUDED.cpu_usage_percent,
          cpu_cores_used = EXCLUDED.cpu_cores_used,
          memory_usage_bytes = EXCLUDED.memory_usage_bytes,
          memory_usage_percent = EXCLUDED.memory_usage_percent,
          memory_limit_bytes = EXCLUDED.memory_limit_bytes,
          disk_usage_percent = EXCLUDED.disk_usage_percent,
          disk_usage_bytes = EXCLUDED.disk_usage_bytes,
          disk_io_read_bytes = EXCLUDED.disk_io_read_bytes,
          disk_io_write_bytes = EXCLUDED.disk_io_write_bytes,
          network_rx_bytes = EXCLUDED.network_rx_bytes,
          network_tx_bytes = EXCLUDED.network_tx_bytes,
          network_rx_packets = EXCLUDED.network_rx_packets,
          network_tx_packets = EXCLUDED.network_tx_packets,
          metadata = EXCLUDED.metadata
      `;

      for (const metric of metrics) {
        const values = [
          new Date(metric.timestamp),
          metric.service,
          metric.podName || null,
          metric.nodeName || null,
          metric.namespace || null,
          metric.cpuUsagePercent ?? null,
          metric.cpuCoresUsed ?? null,
          metric.memoryUsageBytes ?? null,
          metric.memoryUsagePercent ?? null,
          metric.memoryLimitBytes ?? null,
          metric.diskUsagePercent ?? null,
          metric.diskUsageBytes ?? null,
          metric.diskIoReadBytes ?? null,
          metric.diskIoWriteBytes ?? null,
          metric.networkRxBytes ?? null,
          metric.networkTxBytes ?? null,
          metric.networkRxPackets ?? null,
          metric.networkTxPackets ?? null,
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
        cpu_usage_percent, cpu_cores_used,
        memory_usage_bytes, memory_usage_percent, memory_limit_bytes,
        disk_usage_percent, disk_usage_bytes, disk_io_read_bytes, disk_io_write_bytes,
        network_rx_bytes, network_tx_bytes, network_rx_packets, network_tx_packets,
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
        cpu_usage_percent, cpu_cores_used,
        memory_usage_bytes, memory_usage_percent, memory_limit_bytes,
        disk_usage_percent, disk_usage_bytes, disk_io_read_bytes, disk_io_write_bytes,
        network_rx_bytes, network_tx_bytes, network_rx_packets, network_tx_packets,
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
        avg_cpu_percent,
        max_cpu_percent,
        min_cpu_percent,
        avg_cpu_cores,
        avg_memory_percent,
        max_memory_percent,
        avg_memory_bytes,
        avg_disk_percent,
        max_disk_percent,
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
   * 연결 종료
   */
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log("TimescaleDB connection pool closed (SystemMetrics)");
  }
}
