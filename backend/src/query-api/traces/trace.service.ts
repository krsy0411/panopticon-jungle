import { Injectable, NotFoundException } from "@nestjs/common";
import { ApmLogRepository } from "../../shared/apm/logs/log.repository";
import { SpanRepository } from "../../shared/apm/spans/span.repository";
import type { TraceResponse } from "./trace.types";

@Injectable()
export class TraceQueryService {
  constructor(
    private readonly spanRepository: SpanRepository,
    private readonly logRepository: ApmLogRepository,
  ) {}

  async getTrace(traceId: string): Promise<TraceResponse> {
    const [spans, logs] = await Promise.all([
      this.spanRepository.findByTraceId({ traceId }),
      this.logRepository.findByTraceId({ traceId }),
    ]);

    if (spans.length === 0 && logs.length === 0) {
      throw new NotFoundException(
        `해당 trace_id(${traceId})에 대한 스팬/로그를 찾을 수 없습니다.`,
      );
    }

    return {
      trace_id: traceId,
      spans: spans.map((span) => ({
        timestamp: span["@timestamp"],
        span_id: span.span_id,
        parent_span_id: span.parent_span_id ?? undefined,
        name: span.name,
        kind: span.kind,
        duration_ms: span.duration_ms,
        status: span.status,
        service_name: span.service_name,
        environment: span.environment,
        labels: span.labels,
        http_method: span.http_method,
        http_path: span.http_path,
        http_status_code: span.http_status_code,
      })),
      logs: logs.map((log) => ({
        timestamp: log["@timestamp"],
        level: log.level,
        message: log.message,
        service_name: log.service_name,
        environment: log.environment,
        trace_id: log.trace_id,
        span_id: log.span_id,
        labels: log.labels,
      })),
    };
  }
}
