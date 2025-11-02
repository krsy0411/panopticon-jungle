import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Client } from "@elastic/elasticsearch";

export interface LogDocument {
  "@timestamp": string;
  service: string;
  level: string;
  message: string;
  remoteAddress: string | null;
  userAgent: string | null;
  ingestedAt: string;
}

export interface SearchLogsParams {
  service?: string;
  level?: string;
  limit?: number;
}

export interface LogSearchResult extends LogDocument {
  id: string;
}

@Injectable()
export class LogRepository implements OnModuleDestroy {
  private readonly logger = new Logger(LogRepository.name);
  private readonly client: Client;
  private readonly index: string;

  constructor() {
    const node = process.env.ELASTICSEARCH_NODE ?? "http://localhost:9200";
    this.index = process.env.ELASTICSEARCH_INDEX ?? "app-logs";
    this.client = new Client({ node });
  }

  async save(document: LogDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.index,
        document,
      });
    } catch (error) {
      this.logger.error(
        "Failed to index log",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async search(params: SearchLogsParams): Promise<LogSearchResult[]> {
    const { service, level, limit } = params;
    const must: Array<Record<string, unknown>> = [];

    if (service) {
      must.push({ term: { "service.keyword": service } });
    }

    if (level) {
      must.push({ term: { level } });
    }

    const query = must.length > 0 ? { bool: { must } } : { match_all: {} };

    const size = limit ?? Number(process.env.LOG_LIST_DEFAULT_LIMIT ?? 50);

    const response = await this.client.search<LogDocument>({
      index: this.index,
      size,
      sort: [{ "@timestamp": { order: "desc" as const } }],
      query,
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

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
