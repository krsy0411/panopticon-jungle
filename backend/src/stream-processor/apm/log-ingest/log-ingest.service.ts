import { Injectable } from "@nestjs/common";
import { ApmLogRepository } from "../../../shared/apm/logs/log.repository";
import type { LogEventDto } from "../../../shared/apm/logs/dto/log-event.dto";
import type { LogDocument } from "../../../shared/apm/logs/log.document";

/**
 * Kafka에서 들어온 로그 이벤트를 Elasticsearch에 저장하는 서비스
 */
@Injectable()
export class LogIngestService {
  constructor(private readonly repository: ApmLogRepository) {}

  async ingest(dto: LogEventDto): Promise<void> {
    const document: LogDocument = {
      "@timestamp": this.resolveTimestamp(dto.timestamp),
      type: "log",
      service_name: dto.service_name,
      environment: dto.environment,
      trace_id: dto.trace_id,
      span_id: dto.span_id,
      level: dto.level,
      message: dto.message,
      http_method: dto.http_method,
      http_path: dto.http_path,
      http_status_code: dto.http_status_code,
      labels: this.normalizeLabels(dto.labels),
      ingestedAt: new Date().toISOString(),
    };

    await this.repository.save(document);
  }

  /**
   * 이벤트에 타임스탬프가 없다면 현재 시각으로 보정한다.
   */
  private resolveTimestamp(value?: string): string {
    if (value && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * labels 객체를 문자열/숫자/불리언으로만 구성되도록 정규화한다.
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
