import { Injectable } from "@nestjs/common";
import type { SpanEventDto } from "../../../shared/apm/spans/dto/span-event.dto";
import type { SpanDocument } from "../../../shared/apm/spans/span.document";
import type { LogStreamKey } from "../../../shared/logs/log-storage.service";
import { BulkIndexerService } from "../../common/bulk-indexer.service";

/**
 * 스팬 이벤트를 Elasticsearch에 저장하는 서비스
 */
@Injectable()
export class SpanIngestService {
  private static readonly STREAM_KEY: LogStreamKey = "apmSpans";

  constructor(private readonly bulkIndexer: BulkIndexerService) {}

  ingest(dto: SpanEventDto): void {
    const document: SpanDocument = {
      "@timestamp": this.resolveTimestamp(dto.timestamp),
      type: "span",
      service_name: dto.service_name,
      environment: dto.environment,
      trace_id: dto.trace_id,
      span_id: dto.span_id,
      parent_span_id: dto.parent_span_id ?? null,
      name: dto.name,
      kind: dto.kind,
      duration_ms: dto.duration_ms,
      status: dto.status,
      http_method: dto.http_method,
      http_path: dto.http_path,
      http_status_code: dto.http_status_code,
      labels: this.normalizeLabels(dto.labels),
      ingestedAt: new Date().toISOString(),
    };

    // 스팬 문서를 BulkIndexer 버퍼에 적재해 Kafka 처리가 지연되지 않도록 한다.
    this.bulkIndexer.enqueue(SpanIngestService.STREAM_KEY, document);
  }

  /**
   * 스팬 시작 시각이 비어 있을 때 현재 시각으로 보정한다.
   */
  private resolveTimestamp(value?: string): string {
    if (value && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * labels 값을 문자열/숫자/불리언으로 변환하여 색인한다.
   */
  private normalizeLabels(
    labels?: Record<string, unknown>,
  ): Record<string, string | number | boolean> | undefined {
    if (!labels) {
      return undefined;
    }

    return Object.entries(labels).reduce<
      Record<string, string | number | boolean>
    >((acc, [key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        acc[key] = value;
      } else if (value != null) {
        acc[key] = JSON.stringify(value);
      }
      return acc;
    }, {});
  }
}
