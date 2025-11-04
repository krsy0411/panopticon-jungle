import { Injectable } from "@nestjs/common";
import type { LogStreamKey } from "../log-storage.service";
import { LogStorageService } from "../log-storage.service";
import {
  type BaseLogDocument,
  BaseLogRepository,
  type LogSearchResult,
} from "../base-log.repository";

export interface HttpLogDocument extends BaseLogDocument {
  request_id: string | null;
  client_ip: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  request_time: number | null;
  user_agent: string | null;
  upstream_service: string | null;
  upstream_status: number | null;
  upstream_response_time: number | null;
}

export interface SearchHttpLogsParams {
  method?: string;
  path?: string;
  statusCode?: number;
  limit?: number;
}

export interface HttpStatusCodeCountsParams {
  start: string;
  end: string;
  interval: string;
}

export interface HttpStatusCodeCountBucket {
  timestamp: string;
  total: number;
  counts: Record<string, number>;
}

@Injectable()
export class HttpLogRepository extends BaseLogRepository<HttpLogDocument> {
  private static readonly STREAM_KEY: LogStreamKey = "http";

  constructor(storage: LogStorageService) {
    super(storage, HttpLogRepository.STREAM_KEY);
  }

  async search(
    params: SearchHttpLogsParams,
  ): Promise<Array<LogSearchResult<HttpLogDocument>>> {
    const { method, path, statusCode, limit } = params;
    const must: Array<Record<string, unknown>> = [];

    if (method) {
      must.push({ term: { method: method.toUpperCase() } });
    }

    if (path) {
      must.push({ term: { path } });
    }

    if (typeof statusCode === "number") {
      must.push({ term: { status_code: statusCode } });
    }

    const query = must.length > 0 ? { bool: { must } } : { match_all: {} };
    const size = limit ?? Number(process.env.LOG_LIST_DEFAULT_LIMIT ?? 50);

    const response = await this.client.search<HttpLogDocument>({
      index: this.dataStream,
      size,
      sort: [{ "@timestamp": { order: "desc" as const } }],
      query,
    });

    return response.hits.hits
      .filter(
        (hit): hit is typeof hit & { _source: HttpLogDocument; _id: string } =>
          Boolean(hit._source) && typeof hit._id === "string",
      )
      .map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));
  }

  async aggregateStatusCodeCounts(
    params: HttpStatusCodeCountsParams,
  ): Promise<HttpStatusCodeCountBucket[]> {
    const { start, end, interval } = params;

    type AggregationsResponse = {
      per_interval?: {
        buckets: Array<{
          key: number;
          key_as_string?: string;
          doc_count: number;
          status_codes?: {
            buckets: Array<{
              key: number | string;
              doc_count: number;
            }>;
          };
        }>;
      };
    };

    const response = await this.client.search<HttpLogDocument, AggregationsResponse>({
      index: this.dataStream,
      size: 0,
      query: {
        range: {
          "@timestamp": {
            gte: start,
            lte: end,
          },
        },
      },
      aggs: {
        per_interval: {
          date_histogram: {
            field: "@timestamp",
            fixed_interval: interval,
          },
          aggs: {
            status_codes: {
              terms: {
                field: "status_code",
                size: 100,
              },
            },
          },
        },
      },
    });

    const buckets = response.aggregations?.per_interval?.buckets ?? [];

    return buckets.map((bucket) => {
      const counts =
        Object.fromEntries(
          bucket.status_codes?.buckets.map((statusBucket) => [
            String(statusBucket.key),
            statusBucket.doc_count,
          ]) ?? [],
        );

      return {
        timestamp: bucket.key_as_string ?? new Date(bucket.key).toISOString(),
        total: bucket.doc_count,
        counts,
      };
    });
  }
}
