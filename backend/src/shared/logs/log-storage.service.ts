import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Client, ClientOptions, errors } from "@elastic/elasticsearch";
import { Transport, TransportOptions } from "@elastic/transport";

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
  private readonly useIsm: boolean;

  private static readonly OpenSearchTransport = class extends Transport {
    constructor(opts: TransportOptions) {
      const patchedOpts: TransportOptions & {
        productCheck?: string;
      } = {
        ...opts,
        vendoredHeaders: {
          jsonContentType: "application/json",
          ndjsonContentType: "application/x-ndjson",
          accept: "application/json,text/plain",
        },
      };
      delete patchedOpts.productCheck;
      super(patchedOpts);
    }
  };

  constructor() {
    this.useIsm =
      typeof process.env.USE_ISM === "string" &&
      process.env.USE_ISM.toLowerCase() === "true";

    const node = process.env.ELASTICSEARCH_NODE ?? "http://localhost:9200";
    const username = process.env.OPENSEARCH_USERNAME;
    const password = process.env.OPENSEARCH_PASSWORD;
    const auth = username && password ? { username, password } : undefined;

    const tls =
      process.env.OPENSEARCH_REJECT_UNAUTHORIZED === "false"
        ? { rejectUnauthorized: false }
        : undefined;

    const clientOptions: ClientOptions = { node, auth, tls };

    this.client = this.useIsm
      ? new Client({
          ...clientOptions,
          Transport: LogStorageService.OpenSearchTransport,
        })
      : new Client(clientOptions);

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
      if (this.useIsm) {
        await this.ensureIsmPolicy(config);
        await this.ensureDataStream(config);
      } else {
        await this.ensureIlmPolicy(config);
        await this.ensureTemplate(config);
        await this.ensureDataStream(config);
      }
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

  private async ensureIsmPolicy(config: DataStreamConfig): Promise<void> {
    const policyName =
      process.env.OPENSEARCH_ISM_POLICY ?? `${config.dataStream}-ism-policy`;
    const ismHeaders = {
      "content-type": "application/json",
      accept: "application/json",
    };

    try {
      await this.client.transport.request(
        {
          method: "GET",
          path: `/_plugins/_ism/policies/${policyName}`,
        },
        { headers: ismHeaders },
      );
    } catch (error) {
      if (
        error instanceof errors.ResponseError &&
        error.statusCode === 404
      ) {
        await this.client.transport.request(
          {
            method: "PUT",
            path: `/_plugins/_ism/policies/${policyName}`,
            body: {
              policy: {
                description: `${config.dataStream} retention`,
                default_state: "hot",
                states: [
                  {
                    name: "hot",
                    actions: [
                      {
                        rollover: {
                          min_primary_shard_size: config.rolloverSize,
                          min_index_age: config.rolloverAge,
                        },
                      },
                    ],
                    transitions: [],
                  },
                ],
              },
            },
          },
          { headers: ismHeaders },
        );
        this.logger.log(
          `OpenSearch ISM policy ensured: ${policyName}`,
        );
      } else {
        throw error;
      }
    }

    await this.ensureIsmTemplate(config, policyName, ismHeaders);
  }

  private async ensureIsmTemplate(
    config: DataStreamConfig,
    policyName: string,
    headers: Record<string, string>,
  ): Promise<void> {
    const payload = {
      index_patterns: [config.dataStream],
      priority: 500,
      last_updated_time: Date.now(),
      template: {
        data_stream: {},
        settings: {},
        mappings: config.mappings,
      },
      policy_id: policyName,
    };

    const endpoints = [
      `/_plugins/_ism/templates/${config.templateName}`,
      `/_opendistro/_ism/templates/${config.templateName}`,
    ];

    let lastError: unknown;

    for (const path of endpoints) {
      try {
        await this.client.transport.request(
          {
            method: "POST",
            path,
            body: payload,
          },
          { headers },
        );
        this.logger.log(
          `OpenSearch ISM template ensured via ${path}: ${config.templateName}`,
        );
        return;
      } catch (error) {
        lastError = error;
        if (
          error instanceof errors.ResponseError &&
          error.statusCode === 409
        ) {
          this.logger.warn(
            `OpenSearch ISM template already exists on ${path}: ${config.templateName}`,
          );
          return;
        }

        if (
          error instanceof errors.ResponseError &&
          error.statusCode === 404 &&
          this.isNoHandlerError(error)
        ) {
          continue;
        }

        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("No ISM template endpoint available");
  }

  private isNoHandlerError(error: errors.ResponseError): boolean {
    const body = error.meta?.body;
    if (!body) {
      return false;
    }
    if (typeof body === "string") {
      return body.includes("no handler found");
    }
    if (typeof body === "object") {
      const maybeError =
        (body as { error?: unknown }).error ??
        (body as { Message?: unknown }).Message;
      if (typeof maybeError === "string") {
        return maybeError.includes("no handler found");
      }
    }
    return false;
  }
}
