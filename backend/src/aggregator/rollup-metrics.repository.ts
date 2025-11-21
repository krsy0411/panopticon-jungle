import { Injectable, Logger } from "@nestjs/common";
import type { Client } from "@elastic/elasticsearch";
import { LogStorageService } from "../shared/logs/log-storage.service";
import type { RollupMetricDocument } from "../shared/apm/rollup/rollup-metric.document";

/**
 * 롤업 결과를 metrics data stream 에 저장하는 책임을 가지는 레포지토리
 */
@Injectable()
export class RollupMetricsRepository {
  private readonly logger = new Logger(RollupMetricsRepository.name);
  private readonly client: Client;
  private readonly indexName: string;

  constructor(storage: LogStorageService) {
    this.client = storage.getClient();
    this.indexName = storage.getDataStream("apmRollupMetrics");
  }

  /**
   * 1분 버킷 묶음을 bulk API를 통해 저장한다.
   */
  async bulkCreate(documents: RollupMetricDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    const operations: Array<Record<string, unknown>> = documents.flatMap(
      (doc) => [
        {
          create: {
            _index: this.indexName,
            _id: this.buildDocumentId(doc),
          },
        },
        doc,
      ],
    );

    // `_bulk` 수행 시간을 남겨 두면 저장 구간별 병목을 쉽게 추적할 수 있다.
    const started = Date.now();
    const response = await this.client.bulk({
      operations,
      refresh: false,
    });
    const elapsed = Date.now() - started;
    if (!response.errors) {
      this.logger.log(
        `롤업 문서를 저장했습니다. index=${this.indexName} docs=${documents.length} took=${elapsed}ms`,
      );
      return;
    }

    const failures = response.items?.flatMap((item) =>
      item.create?.error ? [item.create.error] : [],
    );
    const blocking = failures?.filter(
      (error) => error.type !== "version_conflict_engine_exception",
    );

    if (blocking && blocking.length > 0) {
      const reason = blocking[0]?.reason ?? "알 수 없는 Bulk 에러";
      this.logger.error(
        `롤업 문서 저장 중 치명적인 오류가 발생했습니다. reason=${reason}`,
      );
      throw new Error(reason);
    }

    if (failures && failures.length > 0) {
      this.logger.warn(
        `이미 저장된 롤업 문서를 건너뜁니다. conflicts=${failures.length} took=${elapsed}ms`,
      );
    }
  }

  private buildDocumentId(doc: RollupMetricDocument): string {
    return `${doc.service_name}:${doc.environment}:${doc["@timestamp_bucket"]}`;
  }
}
