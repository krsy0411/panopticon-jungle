import { Injectable } from "@nestjs/common";
import type { LogStreamKey } from "../log-storage.service";
import { LogStorageService } from "../log-storage.service";
import {
  type BaseLogDocument,
  BaseLogRepository,
  type LogSearchResult,
} from "../base-log.repository";

export interface AppLogDocument extends BaseLogDocument {
  service: string;
  level: string;
  message: string;
  remoteAddress: string | null;
  userAgent: string | null;
}

export interface SearchAppLogsParams {
  service?: string;
  level?: string;
  limit?: number;
}

@Injectable()
export class AppLogRepository extends BaseLogRepository<AppLogDocument> {
  private static readonly STREAM_KEY: LogStreamKey = "app";

  constructor(storage: LogStorageService) {
    super(storage, AppLogRepository.STREAM_KEY);
  }

  async search(
    params: SearchAppLogsParams,
  ): Promise<Array<LogSearchResult<AppLogDocument>>> {
    const { service, level, limit } = params;
    const must: Array<Record<string, unknown>> = [];

    if (service) {
      must.push({ term: { "service.keyword": service } });
    }

    if (level) {
      must.push({ term: { "level.keyword": level } });
    }

    const query = must.length > 0 ? { bool: { must } } : { match_all: {} };
    const size = limit ?? Number(process.env.LOG_LIST_DEFAULT_LIMIT ?? 50);

    const response = await this.client.search<AppLogDocument>({
      index: this.dataStream,
      size,
      sort: [{ "@timestamp": { order: "desc" as const } }],
      query,
    });

    return response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: AppLogDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));
  }
}
