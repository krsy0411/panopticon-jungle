import { Injectable } from "@nestjs/common";
import {
  ApmSearchResult,
  BaseApmDocument,
  BaseApmRepository,
} from "../common/base-apm.repository";
import type { LogDocument } from "./log.document";
import { LogStorageService } from "../../logs/log-storage.service";

export interface LogSearchParams {
  traceId: string;
  size?: number;
  serviceName?: string;
  environment?: string;
}

export interface LogListQuery {
  serviceName?: string;
  environment?: string;
  level?: "DEBUG" | "INFO" | "WARN" | "ERROR";
  traceId?: string;
  spanId?: string;
  message?: string;
  from: string;
  to: string;
  page: number;
  size: number;
  sort: "asc" | "desc";
}

export interface LogSearchResult<T extends BaseApmDocument = LogDocument> {
  total: number;
  hits: Array<ApmSearchResult<T>>;
}

/**
 * 로그 데이터 스트림을 다루는 레포지토리
 * - 트레이스 단위 조회 및 범용 검색 기능을 제공
 */
@Injectable()
export class ApmLogRepository extends BaseApmRepository<LogDocument> {
  private static readonly STREAM_KEY = "apmLogs";

  constructor(storage: LogStorageService) {
    super(storage, ApmLogRepository.STREAM_KEY);
  }

  async findByTraceId(
    params: LogSearchParams,
  ): Promise<Array<ApmSearchResult<LogDocument>>> {
    const size = params.size ?? 200;
    const filter: Array<Record<string, unknown>> = [
      { term: { trace_id: params.traceId } },
    ];
    if (params.serviceName) {
      filter.push({ term: { service_name: params.serviceName } });
    }
    if (params.environment) {
      filter.push({ term: { environment: params.environment } });
    }

    const response = await this.client.search<LogDocument>({
      index: this.dataStream,
      size,
      sort: [{ "@timestamp": { order: "asc" as const } }],
      query: {
        bool: {
          filter,
        },
      },
    });

    return response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: LogDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));
  }

  /**
   * 로그를 범용 조건으로 검색한다.
   */
  async searchLogs(params: LogListQuery): Promise<LogSearchResult> {
    const from = (params.page - 1) * params.size;
    const must: Array<Record<string, unknown>> = [];
    const filter: Array<Record<string, unknown>> = [
      {
        range: {
          "@timestamp": {
            gte: params.from,
            lte: params.to,
          },
        },
      },
    ];

    if (params.serviceName) {
      filter.push({ term: { service_name: params.serviceName } });
    }
    if (params.environment) {
      filter.push({ term: { environment: params.environment } });
    }
    if (params.level) {
      filter.push({ term: { level: params.level } });
    }
    if (params.traceId) {
      filter.push({ term: { trace_id: params.traceId } });
    }
    if (params.spanId) {
      filter.push({ term: { span_id: params.spanId } });
    }
    if (params.message) {
      must.push({
        match: {
          message: {
            query: params.message,
            operator: "and",
          },
        },
      });
    }

    const response = await this.client.search<LogDocument>({
      index: this.dataStream,
      from,
      size: params.size,
      sort: [{ "@timestamp": { order: params.sort } }],
      track_total_hits: true,
      query: {
        bool: {
          filter,
          must: must.length > 0 ? must : undefined,
        },
      },
    });

    const hits = response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: LogDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return {
      total,
      hits,
    };
  }
}
