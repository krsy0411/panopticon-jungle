import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { BaseApmDocument } from "../../shared/apm/common/base-apm.repository";
import {
  LogStorageService,
  type LogStreamKey,
} from "../../shared/logs/log-storage.service";
import type { Client } from "@elastic/elasticsearch";

interface BufferedItem {
  index: string;
  document: BaseApmDocument;
  size: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Elasticsearch Bulk API를 이용해 로그/스팬을 배치 단위로 색인하는 유틸리티
 * - 버퍼에 문서를 모았다가 크기/시간 조건을 만족하면 NDJSON 형태로 전송
 * - 동시 플러시 수를 제한해 ES 클러스터 과부하를 막는다
 */
@Injectable()
export class BulkIndexerService implements OnModuleDestroy {
  private readonly logger = new Logger(BulkIndexerService.name);
  private readonly client: Client;
  private readonly maxBatchSize: number;
  private readonly maxBatchBytes: number;
  private readonly flushIntervalMs: number;
  private readonly maxParallelFlushes: number;

  private buffer: BufferedItem[] = [];
  private bufferedBytes = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private inFlightFlushes = 0;
  private pendingFlush = false;

  constructor(private readonly storage: LogStorageService) {
    this.client = this.storage.getClient();
    this.maxBatchSize = Math.max(
      1,
      Number.parseInt(process.env.BULK_BATCH_SIZE ?? "500", 10),
    );
    const byteLimitMb = Number.parseFloat(
      process.env.BULK_BATCH_BYTES_MB ?? "5",
    );
    this.maxBatchBytes = Math.max(1024, Math.floor(byteLimitMb * 1024 * 1024));
    this.flushIntervalMs = Math.max(
      100,
      Number.parseInt(process.env.BULK_FLUSH_INTERVAL_MS ?? "1000", 10),
    );
    this.maxParallelFlushes = Math.max(
      1,
      Number.parseInt(process.env.BULK_MAX_PARALLEL_FLUSHES ?? "1", 10),
    );
  }

  /**
   * Bulk 버퍼에 문서를 추가하고 조건을 만족하면 즉시 플러시한다.
   */
  enqueue(streamKey: LogStreamKey, document: BaseApmDocument): Promise<void> {
    const indexName = this.storage.getDataStream(streamKey);
    const size =
      Buffer.byteLength(JSON.stringify({ index: { _index: indexName } })) +
      Buffer.byteLength(JSON.stringify(document)) +
      2;

    return new Promise<void>((resolve, reject) => {
      this.buffer.push({ index: indexName, document, size, resolve, reject });
      this.bufferedBytes += size;
      if (this.shouldFlushBySize()) {
        this.triggerFlush();
      } else {
        this.ensureFlushTimer();
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flushRemaining();
    }
  }

  /**
   * 버퍼가 비어있지 않다면 즉시 flush를 수행한다.
   */
  private triggerFlush(): void {
    if (this.buffer.length === 0) {
      return;
    }
    if (this.inFlightFlushes >= this.maxParallelFlushes) {
      this.pendingFlush = true;
      return;
    }

    const batch = this.drainBuffer();
    if (batch.length === 0) {
      return;
    }

    this.inFlightFlushes += 1;
    void this.executeFlush(batch)
      .catch((error) => {
        this.logger.error(
          "Bulk 색인 도중 예기치 않은 오류가 발생했습니다.",
          error instanceof Error ? error.stack : String(error),
        );
      })
      .finally(() => {
        this.inFlightFlushes -= 1;
        if (this.pendingFlush) {
          this.pendingFlush = false;
          this.triggerFlush();
        } else if (this.shouldFlushBySize()) {
          this.triggerFlush();
        } else if (this.buffer.length > 0) {
          this.ensureFlushTimer();
        }
      });
  }

  private shouldFlushBySize(): boolean {
    return (
      this.buffer.length >= this.maxBatchSize ||
      this.bufferedBytes >= this.maxBatchBytes
    );
  }

  private ensureFlushTimer(): void {
    if (this.flushTimer || this.buffer.length === 0) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.triggerFlush();
    }, this.flushIntervalMs);
  }

  private drainBuffer(): BufferedItem[] {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const batch = this.buffer;
    this.buffer = [];
    this.bufferedBytes = 0;
    return batch;
  }

  private async executeFlush(batch: BufferedItem[]): Promise<void> {
    const operations = this.buildOperations(batch);
    try {
      const response = await this.client.bulk({ operations });
      if (response.errors) {
        this.logBulkError(response);
        const error = new Error("Bulk 색인 중 일부 문서가 실패했습니다.");
        batch.forEach((item) => item.reject(error));
        return;
      }
      batch.forEach((item) => item.resolve());
      this.logger.debug(
        `Bulk 색인 완료 batch=${batch.length} took=${response.took ?? 0}ms`,
      );
    } catch (error) {
      const wrapped =
        error instanceof Error
          ? error
          : new Error(`Bulk 색인 실패: ${String(error)}`);
      batch.forEach((item) => item.reject(wrapped));
      this.logger.warn(
        "Bulk 색인 요청이 실패했습니다. Kafka 컨슈머가 재시도합니다.",
        wrapped.stack,
      );
    }
  }

  private buildOperations(
    batch: BufferedItem[],
  ): Array<Record<string, unknown>> {
    const operations: Array<Record<string, unknown>> = [];
    for (const item of batch) {
      // 데이터 스트림은 create op만 허용하므로 bulk 액션을 create로 지정한다.
      operations.push({ create: { _index: item.index } });
      operations.push({ ...item.document });
    }
    return operations;
  }

  private logBulkError(response: { items?: Array<Record<string, any>> }): void {
    const firstError = response.items
      ?.map((item) => Object.values(item)[0])
      .find((result) => result && result.error);
    if (firstError) {
      this.logger.error(
        `Bulk 색인 실패: type=${firstError.error?.type} reason=${firstError.error?.reason}`,
      );
    } else {
      this.logger.error("Bulk 색인 실패: 응답 내 오류 세부 정보 없음");
    }
  }

  private async flushRemaining(): Promise<void> {
    while (this.buffer.length > 0 || this.inFlightFlushes > 0) {
      if (this.buffer.length > 0) {
        this.triggerFlush();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
