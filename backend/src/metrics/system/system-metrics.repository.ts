import { Injectable, Logger } from "@nestjs/common";
import { CreateSystemMetricDto } from "./dto/create-system-metric.dto";
import { TimescaleConnectionService } from "../common/timescale-connection.service";

/**
 * 시스템 메트릭 저장소
 * TimescaleDB에 CPU, 메모리, 디스크, 네트워크 등 인프라 메트릭 저장
 */
@Injectable()
export class SystemMetricsRepository {
  private readonly logger = new Logger(SystemMetricsRepository.name);

  constructor(private readonly connectionService: TimescaleConnectionService) {}

  /**
   * 단일 시스템 메트릭 저장
   */
  async save(createMetricDto: CreateSystemMetricDto): Promise<void> {
    const query = `
      INSERT INTO system_metrics (
        timestamp, service, pod_name, node_name, namespace,
        cpu_usage_percent, memory_usage_bytes, disk_usage_percent,
        network_rx_bytes, network_tx_bytes,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10,
        $11
      )
      ON CONFLICT (timestamp, service) DO UPDATE SET
        pod_name = EXCLUDED.pod_name,
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
      await this.connectionService.getPool().query(query, values);
    } catch (error) {
      this.logger.error(
        "Failed to save system metric to TimescaleDB",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 시스템 메트릭 집계 조회 (단순 쿼리만 수행)
   * Service 레이어에서 병합하여 사용
   */
  async findAggregatedByTimeRange(
    startTime: Date,
    endTime: Date,
    intervalMinutes: number,
  ): Promise<
    Array<{
      bucket: Date;
      avgCpu: number;
      avgMemoryBytes: number;
    }>
  > {
    const query = `
      SELECT
        time_bucket($1::interval, timestamp) as bucket,
        AVG(cpu_usage_percent) as avg_cpu,
        AVG(memory_usage_bytes) as avg_memory_bytes
      FROM system_metrics
      WHERE timestamp >= $2 AND timestamp <= $3
      GROUP BY bucket
      ORDER BY bucket
    `;

    try {
      const result = await this.connectionService.getPool().query<{
        bucket: Date;
        avg_cpu: string;
        avg_memory_bytes: string;
      }>(query, [`${intervalMinutes} minutes`, startTime, endTime]);

      return result.rows.map((row) => ({
        bucket: row.bucket,
        avgCpu: Number(row.avg_cpu) || 0,
        avgMemoryBytes: Number(row.avg_memory_bytes) || 0,
      }));
    } catch (error) {
      this.logger.error(
        "Failed to query aggregated system metrics",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
