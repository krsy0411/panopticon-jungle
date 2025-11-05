import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Pool, PoolClient } from "pg";

/**
 * TimescaleDB 연결 풀 관리 서비스
 * 싱글톤으로 동작하여 모든 repository가 공유하는 DB 연결 풀 제공
 */
@Injectable()
export class TimescaleConnectionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TimescaleConnectionService.name);
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
      this.logger.log("TimescaleDB connected");
    });

    this.pool.on("error", (err: Error) => {
      this.logger.error("TimescaleDB connection error", err.stack);
    });

    // 연결 테스트
    try {
      const client = await this.pool.connect();
      await client.query("SELECT 1");
      client.release();
      this.logger.log(
        `✅ TimescaleDB connection verified: ${process.env.TIMESCALE_HOST}:${process.env.TIMESCALE_PORT}/${process.env.TIMESCALE_DATABASE}`,
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
   * 연결 풀 반환
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error("TimescaleDB pool not initialized");
    }
    return this.pool;
  }

  /**
   * 클라이언트 연결 획득
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * 쿼리 실행 헬퍼
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    queryText: string,
    values?: unknown[],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(queryText, values);
    return result.rows;
  }

  /**
   * 연결 종료
   */
  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log("TimescaleDB connection pool closed");
    }
  }
}
