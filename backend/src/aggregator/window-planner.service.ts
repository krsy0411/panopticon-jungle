import { Injectable, Logger } from "@nestjs/common";
import { RollupCheckpointService } from "./rollup-checkpoint.service";
import { RollupConfigService } from "./rollup-config.service";
import type { MinuteWindow } from "./types/minute-window.type";

/**
 * 언제 어떤 1분 버킷을 집계해야 하는지 결정하는 서비스
 * - 체크포인트와 현재 시각을 비교해 "닫힌(closed) 분"만 반환한다.
 */
@Injectable()
export class MinuteWindowPlanner {
  private readonly logger = new Logger(MinuteWindowPlanner.name);

  constructor(
    private readonly checkpoint: RollupCheckpointService,
    private readonly config: RollupConfigService,
  ) {}

  async plan(now: Date = new Date()): Promise<MinuteWindow[]> {
    if (!this.config.isEnabled()) {
      return [];
    }

    const bucketMs = this.config.getBucketDurationMs();
    const closedUntil = this.floorToBucket(now.getTime(), bucketMs);
    if (closedUntil == null) {
      return [];
    }

    const last = await this.checkpoint.loadLastCheckpoint();
    const initialStart =
      last?.getTime() ??
      Math.max(0, closedUntil - this.config.getInitialLookbackMs());

    let nextStart = this.alignToBucket(initialStart, bucketMs);
    const windows: MinuteWindow[] = [];

    while (nextStart + bucketMs <= closedUntil) {
      const start = new Date(nextStart);
      const end = new Date(nextStart + bucketMs);
      windows.push({ start, end });
      nextStart += bucketMs;
    }

    if (windows.length === 0) {
      this.logger.debug("집계 가능한 닫힌 분이 없어 이번 주기를 건너뜁니다.");
    }

    return windows;
  }

  private floorToBucket(timestamp: number, bucketMs: number): number | null {
    if (Number.isNaN(timestamp) || timestamp <= 0) {
      return null;
    }
    return timestamp - (timestamp % bucketMs);
  }

  private alignToBucket(timestamp: number, bucketMs: number): number {
    const remainder = timestamp % bucketMs;
    if (remainder === 0) {
      return timestamp;
    }
    return timestamp - remainder;
  }
}
