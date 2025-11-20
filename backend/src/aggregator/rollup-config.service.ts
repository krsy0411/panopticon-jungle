import { Injectable } from "@nestjs/common";

/**
 * 롤업 집계기에 필요한 환경 변수/기본값을 캡슐화한 설정 서비스
 * - 각 값은 한 곳에서만 계산해 다른 서비스들이 SOLID 원칙을 지킬 수 있게 한다.
 */
@Injectable()
export class RollupConfigService {
  private readonly enabled =
    (process.env.ROLLUP_AGGREGATOR_ENABLED ?? "true").toLowerCase() === "true";

  private readonly bucketSeconds = this.parseNumber(
    process.env.ROLLUP_BUCKET_SECONDS,
    60,
  );

  private readonly pollIntervalMs = this.parseNumber(
    process.env.ROLLUP_POLL_INTERVAL_MS,
    15_000,
  );

  private readonly initialLookbackMinutes = this.parseNumber(
    process.env.ROLLUP_INITIAL_LOOKBACK_MINUTES,
    5,
  );

  private readonly maxServiceBuckets = this.parseNumber(
    process.env.ROLLUP_MAX_SERVICE_BUCKETS,
    200,
  );

  private readonly maxEnvironmentBuckets = this.parseNumber(
    process.env.ROLLUP_MAX_ENV_BUCKETS,
    10,
  );

  private readonly checkpointIndex =
    process.env.ROLLUP_CHECKPOINT_INDEX ?? ".metrics-rollup-state";

  private readonly rollupIndexPrefix =
    process.env.ROLLUP_INDEX_PREFIX ?? "metrics-apm";

  isEnabled(): boolean {
    return this.enabled;
  }

  getBucketDurationSeconds(): number {
    return this.bucketSeconds;
  }

  getBucketDurationMs(): number {
    return this.bucketSeconds * 1000;
  }

  getPollIntervalMs(): number {
    return this.pollIntervalMs;
  }

  getInitialLookbackMs(): number {
    return this.initialLookbackMinutes * 60 * 1000;
  }

  getMaxServiceBuckets(): number {
    return this.maxServiceBuckets;
  }

  getMaxEnvironmentBuckets(): number {
    return this.maxEnvironmentBuckets;
  }

  getCheckpointIndex(): string {
    return this.checkpointIndex;
  }

  getRollupIndexPrefix(): string {
    return this.rollupIndexPrefix;
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return fallback;
  }
}
