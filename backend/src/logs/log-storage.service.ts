import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Client, errors } from "@elastic/elasticsearch";

const DEFAULT_ROLLOVER_SIZE = "10gb";
const DEFAULT_ROLLOVER_AGE = "1d";

export type LogStreamKey = "app" | "http";

interface DataStreamConfig {
  key: LogStreamKey;
  dataStream: string;
  templateName: string;
  ilmPolicyName: string;
  mappings: Record<string, unknown>;
  rolloverSize: string;
  rolloverAge: string;
}

@Injectable()
export class LogStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogStorageService.name);
  private readonly client: Client;
  private readonly configs: Record<LogStreamKey, DataStreamConfig>;

  constructor() {
    const node = process.env.ELASTICSEARCH_NODE ?? "http://localhost:9200";
    this.client = new Client({ node });

    const appStream = process.env.ELASTICSEARCH_APP_DATA_STREAM ?? "logs-app";
    const httpStream =
      process.env.ELASTICSEARCH_HTTP_DATA_STREAM ?? "logs-http";

    this.configs = {
      app: {
        key: "app",
        dataStream: appStream,
        templateName:
          process.env.ELASTICSEARCH_APP_TEMPLATE ?? `${appStream}-template`,
        ilmPolicyName:
          process.env.ELASTICSEARCH_APP_ILM_POLICY ?? `${appStream}-ilm-policy`,
        rolloverSize:
          process.env.ELASTICSEARCH_APP_ROLLOVER_SIZE ?? DEFAULT_ROLLOVER_SIZE,
        rolloverAge:
          process.env.ELASTICSEARCH_APP_ROLLOVER_AGE ?? DEFAULT_ROLLOVER_AGE,
        mappings: {
          properties: {
            "@timestamp": { type: "date" },
            service: { type: "keyword" },
            level: { type: "keyword" },
            message: { type: "text" },
            remoteAddress: { type: "ip" },
            userAgent: { type: "keyword", ignore_above: 512 },
            ingestedAt: { type: "date" },
          },
        },
      },
      http: {
        key: "http",
        dataStream: httpStream,
        templateName:
          process.env.ELASTICSEARCH_HTTP_TEMPLATE ?? `${httpStream}-template`,
        ilmPolicyName:
          process.env.ELASTICSEARCH_HTTP_ILM_POLICY ??
          `${httpStream}-ilm-policy`,
        rolloverSize:
          process.env.ELASTICSEARCH_HTTP_ROLLOVER_SIZE ?? DEFAULT_ROLLOVER_SIZE,
        rolloverAge:
          process.env.ELASTICSEARCH_HTTP_ROLLOVER_AGE ?? DEFAULT_ROLLOVER_AGE,
        mappings: {
          properties: {
            "@timestamp": { type: "date" },
            request_id: { type: "keyword" },
            client_ip: { type: "ip" },
            method: { type: "keyword" },
            path: { type: "keyword" },
            status_code: { type: "integer" },
            request_time: { type: "double" },
            user_agent: { type: "keyword", ignore_above: 512 },
            upstream_service: { type: "keyword" },
            upstream_status: { type: "integer" },
            upstream_response_time: { type: "double" },
            ingestedAt: { type: "date" },
          },
        },
      },
    };
  }

  getClient(): Client {
    return this.client;
  }

  getDataStream(key: LogStreamKey): string {
    return this.configs[key].dataStream;
  }

  getConfig(key: LogStreamKey): DataStreamConfig {
    return this.configs[key];
  }

  async onModuleInit(): Promise<void> {
    for (const config of Object.values(this.configs)) {
      await this.ensureIlmPolicy(config);
      await this.ensureTemplate(config);
      await this.ensureDataStream(config);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  private async ensureIlmPolicy(config: DataStreamConfig): Promise<void> {
    try {
      await this.client.ilm.getLifecycle({ name: config.ilmPolicyName });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        await this.client.ilm.putLifecycle({
          name: config.ilmPolicyName,
          policy: {
            phases: {
              hot: {
                actions: {
                  rollover: {
                    max_primary_shard_size: config.rolloverSize,
                    max_age: config.rolloverAge,
                  },
                },
              },
            },
          },
        });
        this.logger.log(
          `Elasticsearch ILM policy ensured: ${config.ilmPolicyName}`,
        );
      } else {
        throw error;
      }
    }
  }

  private async ensureTemplate(config: DataStreamConfig): Promise<void> {
    try {
      await this.client.indices.getIndexTemplate({
        name: config.templateName,
      });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        await this.client.indices.putIndexTemplate({
          name: config.templateName,
          index_patterns: [config.dataStream],
          data_stream: {},
          template: {
            settings: {
              "index.lifecycle.name": config.ilmPolicyName,
            },
            mappings: config.mappings,
          },
          priority: 500,
        });
        this.logger.log(
          `Elasticsearch index template ensured: ${config.templateName}`,
        );
      } else {
        throw error;
      }
    }
  }

  private async ensureDataStream(config: DataStreamConfig): Promise<void> {
    try {
      await this.client.indices.getDataStream({ name: config.dataStream });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        await this.client.indices.createDataStream({
          name: config.dataStream,
        });
        this.logger.log(
          `Elasticsearch data stream ensured: ${config.dataStream}`,
        );
      } else {
        throw error;
      }
    }
  }
}
