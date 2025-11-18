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
      Number.parseInt(process.env.BULK_BATCH_SIZE ?? "1000", 10),
    );
    const byteLimitMb = Number.parseFloat(
      process.env.BULK_BATCH_BYTES_MB ?? "10",
    );
    this.maxBatchBytes = Math.max(1024, Math.floor(byteLimitMb * 1024 * 1024));
    this.flushIntervalMs = Math.max(
      100,
      Number.parseInt(process.env.BULK_FLUSH_INTERVAL_MS ?? "1000", 10),
    );
    this.maxParallelFlushes = Math.max(
      1,
      Number.parseInt(process.env.BULK_MAX_PARALLEL_FLUSHES ?? "2", 10),
    );
  }

  /**
   * Bulk 버퍼에 문서를 추가하고 조건을 만족하면 즉시 플러시한다.
   * - flush 완료를 기다리지 않으므로 Kafka 컨슈머가 block 되지 않는다.
   */
  enqueue(streamKey: LogStreamKey, document: BaseApmDocument): void {
    const indexName = this.storage.getDataStream(streamKey);
    const size =
      Buffer.byteLength(JSON.stringify({ index: { _index: indexName } })) +
      Buffer.byteLength(JSON.stringify(document)) +
      2;

    this.buffer.push({ index: indexName, document, size });
    this.bufferedBytes += size;
    if (this.shouldFlushBySize()) {
      this.triggerFlush();
    } else {
      this.ensureFlushTimer();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flushRemaining();
    }
  }

  /**
   * 버퍼가 비어있지 않다면 즉시 flush를 수행한다.
   */
  /**
   * 버퍼가 차거나 타이머가 만료되었을 때 실제 bulk 요청을 트리거한다.
   * 동시 플러시 한도에 걸리면 pending 플래그만 세우고 이후에 재시도한다.
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
    void this.executeFlush(batch).finally(() => {
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

  /**
   * 버퍼 건수 혹은 바이트 수가 임계값을 초과했는지 검사한다.
   */
  private shouldFlushBySize(): boolean {
    return (
      this.buffer.length >= this.maxBatchSize ||
      this.bufferedBytes >= this.maxBatchBytes
    );
  }

  /**
   * 일정 시간 동안 문서가 적게 들어오는 경우를 대비해 타이머 기반 플러시를 예약한다.
   */
  private ensureFlushTimer(): void {
    if (this.flushTimer || this.buffer.length === 0) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.triggerFlush();
    }, this.flushIntervalMs);
  }

  /**
   * 현재 버퍼를 비우고 배치로 반환한다. 플러시 타이머도 함께 초기화한다.
   */
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

  /**
   * 실제 Elasticsearch `_bulk` 호출을 수행하고, 각 문서의 Promise를 resolve/reject 한다.
   */
  private async executeFlush(batch: BufferedItem[]): Promise<void> {
    const operations = this.buildOperations(batch);
    try {
      const response = await this.client.bulk({ operations });
      if (response.errors) {
        this.logBulkError(response);
        this.logger.warn(
          `Bulk 색인 중 일부 문서가 실패했습니다. batch=${batch.length} took=${response.took ?? 0}ms`,
        );
      } else {
        this.logger.debug(
          `Bulk 색인 완료 batch=${batch.length} took=${response.took ?? 0}ms`,
        );
      }
    } catch (error) {
      const wrapped =
        error instanceof Error
          ? error
          : new Error(`Bulk 색인 실패: ${String(error)}`);
      this.logger.warn(
        "Bulk 색인 요청이 실패했습니다. Kafka 컨슈머는 메시지를 계속 처리합니다.",
        wrapped instanceof Error ? wrapped.stack : String(wrapped),
      );
    }
  }

  /**
   * Bulk API가 요구하는 `create`/`document` 쌍의 operations 배열을 생성한다.
   */
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

  /**
   * `_bulk` 응답 내 첫 번째 에러 내용을 추출하여 로그로 남긴다.
   */
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

  /**
   * 프로세스 종료 시 남은 버퍼/플러시가 모두 끝날 때까지 기다린다.
   */
  private async flushRemaining(): Promise<void> {
    while (this.buffer.length > 0 || this.inFlightFlushes > 0) {
      if (this.buffer.length > 0) {
        this.triggerFlush();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
