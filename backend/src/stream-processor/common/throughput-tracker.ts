import type { Logger } from "@nestjs/common";

interface ThroughputTrackerOptions {
  label: string;
  batchSize: number;
  minIntervalMs: number;
  targetCount?: number;
}

/**
 * Kafka 컨슈머 처리량을 저비용으로 관찰하기 위한 유틸리티.
 * - batchSize 건 이상 처리했을 때만 로그를 남겨 부담을 줄인다.
 * - 전체/최근 처리량을 모두 기록해 추세를 쉽게 파악할 수 있다.
 */
export class ThroughputTracker {
  private readonly enabled: boolean;
  private readonly startTime = Date.now();
  private lastLogTime = this.startTime;
  private lastLoggedCount = 0;
  private totalCount = 0;

  constructor(
    private readonly logger: Logger,
    private readonly options: ThroughputTrackerOptions,
  ) {
    this.enabled = Number.isFinite(options.batchSize) && options.batchSize > 0;
  }

  markProcessed(delta = 1): void {
    if (!this.enabled) {
      return;
    }

    this.totalCount += delta;
    const processedSinceLast = this.totalCount - this.lastLoggedCount;
    if (processedSinceLast < this.options.batchSize) {
      return;
    }

    const now = Date.now();
    const elapsedSinceLast = now - this.lastLogTime;
    if (elapsedSinceLast < this.options.minIntervalMs) {
      return;
    }

    const totalElapsedMs = now - this.startTime;
    if (totalElapsedMs <= 0) {
      return;
    }

    const overallRate = this.totalCount / (totalElapsedMs / 1000);
    const windowRate =
      processedSinceLast / Math.max(elapsedSinceLast / 1000, 0.001);
    const etaText = this.estimateEta(overallRate);

    // 총 처리 건수, 경과 시간, 전체/최근 초당 처리량, 목표 대비 예상 완료 시점을 한 줄 로그로 남긴다.
    this.logger.log(
      `처리량[${this.options.label}] 총 ${this.totalCount.toLocaleString()}건, 경과 ${this.formatDuration(
        totalElapsedMs,
      )}, 전체 평균 ${overallRate.toFixed(
        1,
      )}건/s, 최근 ${windowRate.toFixed(1)}건/s${etaText}`,
    );

    this.lastLogTime = now;
    this.lastLoggedCount = this.totalCount;
  }

  private estimateEta(overallRate: number): string {
    if (
      !this.options.targetCount ||
      this.options.targetCount <= this.totalCount ||
      overallRate <= 0
    ) {
      return "";
    }
    const remaining = this.options.targetCount - this.totalCount;
    const etaSeconds = remaining / overallRate;
    return `, ETA(${this.options.targetCount.toLocaleString()})≈${this.formatDuration(
      etaSeconds * 1000,
    )}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingSeconds = seconds % 60;
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
}

export function buildThroughputTracker(
  logger: Logger,
  label: string,
): ThroughputTracker {
  const batchSize = Number(process.env.STREAM_THROUGHPUT_BATCH_SIZE ?? "5000");
  const minIntervalMs = Number(
    process.env.STREAM_THROUGHPUT_MIN_INTERVAL_MS ?? "10000",
  );
  const targetCountEnv = process.env.STREAM_THROUGHPUT_TARGET_COUNT;
  const targetCount =
    targetCountEnv != null && targetCountEnv !== ""
      ? Number(targetCountEnv)
      : undefined;

  return new ThroughputTracker(logger, {
    label,
    batchSize: Number.isFinite(batchSize) ? batchSize : 0,
    minIntervalMs: Number.isFinite(minIntervalMs) ? minIntervalMs : 10000,
    targetCount:
      targetCount && Number.isFinite(targetCount) ? targetCount : undefined,
  });
}
