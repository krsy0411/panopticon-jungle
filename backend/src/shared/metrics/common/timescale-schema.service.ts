import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PoolClient } from "pg";
import { TimescaleConnectionService } from "./timescale-connection.service";

/**
 * TimescaleDB 스키마 초기화 서비스
 * 애플리케이션 시작 시 필요한 테이블, 인덱스, 정책 등을 자동 생성
 */
@Injectable()
export class TimescaleSchemaService implements OnModuleInit {
  private readonly logger = new Logger(TimescaleSchemaService.name);

  constructor(private readonly connectionService: TimescaleConnectionService) {}

  async onModuleInit() {
    // Temporary guard for deployments that omit TimescaleDB. Remove when DB is ready.
    if (
      typeof process.env.SKIP_TIMESCALE_INIT === "string" &&
      process.env.SKIP_TIMESCALE_INIT.toLowerCase() === "true"
    ) {
      this.logger.warn(
        "Skipping Timescale schema initialization (SKIP_TIMESCALE_INIT=true)",
      );
      return;
    }

    await this.initializeSchema();
  }

  /**
   * 전체 스키마 초기화
   */
  private async initializeSchema(): Promise<void> {
    const client = await this.connectionService.getClient();

    try {
      // 1. TimescaleDB extension 확인
      await this.createExtension(client);

      // 2. HTTP 메트릭 테이블 초기화
      await this.initializeHttpMetricsTable(client);

      // 3. 시스템 메트릭 테이블 초기화
      await this.initializeSystemMetricsTable(client);
    } catch (error) {
      this.logger.error(
        "Failed to initialize TimescaleDB schema",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * TimescaleDB extension 생성
   */
  private async createExtension(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS timescaledb;
    `);
  }

  /**
   * HTTP 메트릭 테이블 초기화
   */
  private async initializeHttpMetricsTable(client: PoolClient): Promise<void> {
    // 1. 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS http_metrics (
        timestamp TIMESTAMPTZ NOT NULL,
        service TEXT NOT NULL,
        requests INTEGER NOT NULL DEFAULT 0,
        errors NUMERIC(5, 2) NOT NULL DEFAULT 0,
        CONSTRAINT http_metrics_pkey PRIMARY KEY (timestamp, service)
      );
    `);

    // 2. hypertable로 변환
    await client.query(`
      SELECT create_hypertable(
        'http_metrics',
        'timestamp',
        if_not_exists => TRUE
      );
    `);

    // 3. 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_http_metrics_service
      ON http_metrics (service, timestamp DESC);
    `);

    // 4. 보관 정책 (30일 이후 삭제)
    await client.query(`
      SELECT add_retention_policy('http_metrics', INTERVAL '30 days', if_not_exists => TRUE);
    `);
  }

  /**
   * 시스템 메트릭 테이블 초기화
   */
  private async initializeSystemMetricsTable(
    client: PoolClient,
  ): Promise<void> {
    // 1. 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        timestamp TIMESTAMPTZ NOT NULL,
        service TEXT NOT NULL,
        pod_name TEXT,
        node_name TEXT,
        namespace TEXT,
        cpu_usage_percent NUMERIC(5, 2),
        memory_usage_bytes DOUBLE PRECISION,
        disk_usage_percent NUMERIC(5, 2),
        network_rx_bytes DOUBLE PRECISION,
        network_tx_bytes DOUBLE PRECISION,
        metadata JSONB,
        CONSTRAINT system_metrics_pkey PRIMARY KEY (timestamp, service)
      );
    `);

    // 2. hypertable로 변환
    await client.query(`
      SELECT create_hypertable(
        'system_metrics',
        'timestamp',
        if_not_exists => TRUE
      );
    `);

    // 3. 인덱스 생성 - 서비스별
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_metrics_service
      ON system_metrics (service, timestamp DESC);
    `);

    // 4. 인덱스 생성 - Pod별
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_metrics_pod
      ON system_metrics (pod_name, timestamp DESC);
    `);

    // 5. 보관 정책 (30일 이후 삭제)
    await client.query(`
      SELECT add_retention_policy('system_metrics', INTERVAL '30 days', if_not_exists => TRUE);
    `);
  }
}
