import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Client, errors } from "@elastic/elasticsearch";

const DEFAULT_DATA_STREAM = "logs-app";
const DEFAULT_ROLLOVER_SIZE = "10gb";
const DEFAULT_ROLLOVER_AGE = "1d";

/**
 * Elasticsearch 클라이언트 생성, 데이터 스트림/템플릿/ILM 정책 보장을 전담
 */
@Injectable()
export class LogStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogStorageService.name);
  private readonly client: Client;
  private readonly dataStream: string;
  private readonly templateName: string;
  private readonly ilmPolicyName: string;

  constructor() {
    const node = process.env.ELASTICSEARCH_NODE ?? "http://localhost:9200";
    this.dataStream =
      process.env.ELASTICSEARCH_DATA_STREAM ?? DEFAULT_DATA_STREAM;
    this.templateName =
      process.env.ELASTICSEARCH_DATA_STREAM_TEMPLATE ??
      `${this.dataStream}-template`;
    this.ilmPolicyName =
      process.env.ELASTICSEARCH_ILM_POLICY ?? `${this.dataStream}-ilm-policy`;

    this.client = new Client({ node });
  }

  getClient(): Client {
    return this.client;
  }

  getDataStream(): string {
    return this.dataStream;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureIlmPolicy();
    await this.ensureTemplate();
    await this.ensureDataStream();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  private async ensureIlmPolicy(): Promise<void> {
    try {
      await this.client.ilm.getLifecycle({ name: this.ilmPolicyName });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        await this.client.ilm.putLifecycle({
          name: this.ilmPolicyName,
          policy: {
            phases: {
              hot: {
                actions: {
                  rollover: {
                    max_primary_shard_size:
                      process.env.ELASTICSEARCH_ILM_ROLLOVER_SIZE ??
                      DEFAULT_ROLLOVER_SIZE,
                    max_age:
                      process.env.ELASTICSEARCH_ILM_ROLLOVER_AGE ??
                      DEFAULT_ROLLOVER_AGE,
                  },
                },
              },
            },
          },
        });
        this.logger.log(
          `Elasticsearch ILM policy ensured: ${this.ilmPolicyName}`,
        );
      } else {
        throw error;
      }
    }
  }

  private async ensureTemplate(): Promise<void> {
    try {
      await this.client.indices.getIndexTemplate({
        name: this.templateName,
      });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        await this.client.indices.putIndexTemplate({
          name: this.templateName,
          index_patterns: [this.dataStream],
          data_stream: {},
          template: {
            settings: {
              "index.lifecycle.name": this.ilmPolicyName,
            },
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
          priority: 500,
        });
        this.logger.log(
          `Elasticsearch index template ensured: ${this.templateName}`,
        );
      } else {
        throw error;
      }
    }
  }

  private async ensureDataStream(): Promise<void> {
    try {
      await this.client.indices.getDataStream({ name: this.dataStream });
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        await this.client.indices.createDataStream({
          name: this.dataStream,
        });
        this.logger.log(
          `Elasticsearch data stream ensured: ${this.dataStream}`,
        );
      } else {
        throw error;
      }
    }
  }
}
