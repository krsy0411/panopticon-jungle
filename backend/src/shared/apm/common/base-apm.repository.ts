import { Logger } from "@nestjs/common";
import type { Client } from "@elastic/elasticsearch";
import {
  LogStorageService,
  type LogStreamKey,
} from "../../logs/log-storage.service";

/**
 * APM 로그/스팬이 공통으로 사용하는 기본 문서 스키마
 */
export interface BaseApmDocument {
  "@timestamp": string;
  service_name: string;
  environment: string;
  trace_id?: string;
  span_id?: string;
  type: "log" | "span";
  ingestedAt: string;
}

export type ApmSearchResult<TDocument extends BaseApmDocument> = TDocument & {
  id: string;
};

/**
 * Elasticsearch 데이터 스트림과 직접 통신하는 추상 레포지토리
 * - stream-processor: 저장용
 * - query-api: 조회용
 */
export abstract class BaseApmRepository<TDocument extends BaseApmDocument> {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    private readonly storage: LogStorageService,
    private readonly streamKey: LogStreamKey,
  ) {}

  protected get client(): Client {
    return this.storage.getClient();
  }

  protected get dataStream(): string {
    return this.storage.getDataStream(this.streamKey);
  }

  /**
   * 문서를 데이터 스트림에 색인한다.
   */
  async save(document: TDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.dataStream,
        document,
      });
    } catch (error) {
      this.logger.error(
        "APM 문서를 색인하는 중 오류가 발생했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
