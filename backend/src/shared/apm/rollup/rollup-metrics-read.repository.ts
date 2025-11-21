import { Injectable } from "@nestjs/common";
import type { Client } from "@elastic/elasticsearch";
import { LogStorageService } from "../../logs/log-storage.service";
import { normalizeEnvironmentFilter } from "../common/environment.util";
import type { RollupMetricDocument } from "./rollup-metric.document";

export interface RollupMetricsSearchParams {
  serviceName: string;
  environment?: string;
  from: string;
  to: string;
  size: number;
}

/**
 * Query API가 `metrics-apm` 데이터 스트림을 읽어오는 전용 레포지토리
 */
@Injectable()
export class RollupMetricsReadRepository {
  private readonly client: Client;
  private readonly dataStream: string;

  constructor(storage: LogStorageService) {
    this.client = storage.getClient();
    this.dataStream = storage.getDataStream("apmRollupMetrics");
  }

  async search(
    params: RollupMetricsSearchParams,
  ): Promise<RollupMetricDocument[]> {
    const filter: Array<Record<string, unknown>> = [
      { term: { service_name: params.serviceName } },
      {
        range: {
          "@timestamp_bucket": {
            gte: params.from,
            lt: params.to,
          },
        },
      },
    ];

    const env = normalizeEnvironmentFilter(params.environment);
    if (env) {
      filter.push({ term: { environment: env } });
    }

    const response = await this.client.search<RollupMetricDocument>({
      index: this.dataStream,
      size: Math.max(1, params.size),
      sort: [{ "@timestamp_bucket": { order: "asc" as const } }],
      query: {
        bool: {
          filter,
        },
      },
    });

    return response.hits.hits
      .filter((hit): hit is typeof hit & { _source: RollupMetricDocument } =>
        Boolean(hit._source),
      )
      .map((hit) => hit._source);
  }
}
