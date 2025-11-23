import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type Redis from "ioredis";
import RedisClient from "ioredis";
import type { NormalizedServiceMetricsQuery } from "./normalized-service-metrics-query.type";

/**
 * Redis 연결과 메트릭 전용 캐시 키 관리 책임을 전담한다.
 * Redis 장애 시에는 로그만 남기고 기능을 비활성화한다.
 */
@Injectable()
export class MetricsCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsCacheService.name);
  private client: Redis | null;
  private readonly ttlSeconds: number;
  private readonly keyPrefix: string;

  constructor() {
    this.keyPrefix = process.env.METRICS_CACHE_PREFIX ?? "apm:metrics:v1";
    this.ttlSeconds = Number(process.env.METRICS_CACHE_TTL_SECONDS ?? "20");

    const host = process.env.REDIS_HOST;
    if (!host) {
      this.logger.warn(
        "REDIS_HOST 환경 변수가 없어 서비스 메트릭 캐시가 비활성화됩니다.",
      );
      this.client = null;
      return;
    }

    const port = Number(process.env.REDIS_PORT ?? "6379");
    const password = process.env.REDIS_PASSWORD;
    const username = process.env.REDIS_USERNAME;
    const useTls =
      process.env.REDIS_USE_TLS === "true" ||
      process.env.REDIS_TLS === "true" ||
      false;
    const tls = useTls
      ? {
          rejectUnauthorized: process.env.REDIS_REJECT_UNAUTHORIZED !== "false",
          checkServerIdentity:
            process.env.REDIS_CHECK_SERVER_IDENTITY === "false"
              ? () => undefined
              : undefined,
        }
      : undefined;

    this.client = new RedisClient({
      host,
      port,
      password,
      username,
      tls,
      lazyConnect: true,
    });

    this.client.once("ready", () => {
      this.logger.log(
        `Redis 캐시 연결이 완료되었습니다. host=${host} port=${port} prefix=${this.keyPrefix}`,
      );
    });

    this.client.on("error", (error) => {
      this.logger.error(
        "Redis 캐시 연결에서 오류가 발생했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error(
        "Redis 캐시에 연결하지 못해 캐시 레이어를 비활성화합니다.",
        error instanceof Error ? error.stack : String(error),
      );
      this.client.disconnect();
      this.client = null;
    }
  }

  isEnabled(): boolean {
    // Redis 연결이 완전히 구성되지 않은 경우 캐시 레이어를 자동으로 비활성화한다.
    return Boolean(this.client);
  }

  /**
   * 서비스/환경/시간 범위/추가 필터를 안정적으로 표현하는 Redis 키를 만든다.
   */
  buildKey(query: NormalizedServiceMetricsQuery): string {
    const segments = [
      this.keyPrefix,
      `service:${query.serviceName}`,
      `env:${query.environment?.trim() || "all"}`,
      `metric:${query.metric ?? "all"}`,
      `from:${query.from}`,
      `to:${query.to}`,
      `interval:${query.interval}`,
      `filters:${query.cacheFilterSignature}`,
    ];
    return segments.join("|");
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(
        `Redis 캐시 조회 실패(key=${key}). 캐시 미스로 간주합니다.`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    ttlSeconds = this.ttlSeconds,
  ): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.set(key, value, "EX", ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Redis 캐시에 값을 기록하지 못했습니다(key=${key}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
