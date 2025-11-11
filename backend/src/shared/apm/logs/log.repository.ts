import { Injectable } from "@nestjs/common";
import {
  ApmSearchResult,
  BaseApmRepository,
} from "../common/base-apm.repository";
import type { LogDocument } from "./log.document";
import { LogStorageService } from "../../logs/log-storage.service";

export interface LogSearchParams {
  traceId: string;
  size?: number;
}

/**
 * 로그 데이터 스트림을 다루는 레포지토리
 * - trace_id 기준 조회 기능만 노출
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
    const response = await this.client.search<LogDocument>({
      index: this.dataStream,
      size,
      sort: [{ "@timestamp": { order: "asc" as const } }],
      query: {
        bool: {
          must: [{ term: { trace_id: params.traceId } }],
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
}
