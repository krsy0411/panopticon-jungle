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

// APM 로그/스팬/롤업 데이터 스트림 키
export type LogStreamKey = "apmLogs" | "apmSpans" | "apmRollupMetrics";

interface DataStreamConfig {
  key: LogStreamKey;
  dataStream: string;
  templateName: string;
  ilmPolicyName: string;
  mappings: Record<string, unknown>;
  rolloverSize: string;
  rolloverAge: string;
}

/**
 * Elasticsearch 데이터 스트림 생성/보호를 담당하는 인프라 서비스
 * - stream-processor 는 쓰기 전용으로 사용
 * - query-api 는 동일 스트림을 읽기 전용으로 사용
 */
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

    const apmLogsStream =
      process.env.ELASTICSEARCH_APM_LOG_STREAM ?? "logs-apm";
    const apmSpansStream =
      process.env.ELASTICSEARCH_APM_SPAN_STREAM ?? "traces-apm";
    const rollupStream =
      process.env.ELASTICSEARCH_APM_ROLLUP_STREAM ?? "metrics-apm";

    // 데이터 스트림별 매핑 정의
    this.configs = {
      apmLogs: {
        key: "apmLogs",
        dataStream: apmLogsStream,
        templateName:
          process.env.ELASTICSEARCH_APM_LOG_TEMPLATE ??
          `${apmLogsStream}-template`,
        ilmPolicyName:
          process.env.ELASTICSEARCH_APM_LOG_ILM_POLICY ??
          `${apmLogsStream}-ilm-policy`,
        rolloverSize:
          process.env.ELASTICSEARCH_APM_LOG_ROLLOVER_SIZE ??
          DEFAULT_ROLLOVER_SIZE,
        rolloverAge:
          process.env.ELASTICSEARCH_APM_LOG_ROLLOVER_AGE ??
          DEFAULT_ROLLOVER_AGE,
        mappings: {
          properties: {
            "@timestamp": { type: "date" },
            type: { type: "keyword" },
            service_name: { type: "keyword" },
            environment: { type: "keyword" },
            level: { type: "keyword" },
            message: { type: "text" },
            trace_id: { type: "keyword" },
            span_id: { type: "keyword" },
            http_method: { type: "keyword" },
            http_path: { type: "keyword" },
            http_status_code: { type: "integer" },
            labels: { type: "object", dynamic: true },
            ingestedAt: { type: "date" },
          },
        },
      },
      apmSpans: {
        key: "apmSpans",
        dataStream: apmSpansStream,
        templateName:
          process.env.ELASTICSEARCH_APM_SPAN_TEMPLATE ??
          `${apmSpansStream}-template`,
        ilmPolicyName:
          process.env.ELASTICSEARCH_APM_SPAN_ILM_POLICY ??
          `${apmSpansStream}-ilm-policy`,
        rolloverSize:
          process.env.ELASTICSEARCH_APM_SPAN_ROLLOVER_SIZE ??
          DEFAULT_ROLLOVER_SIZE,
        rolloverAge:
          process.env.ELASTICSEARCH_APM_SPAN_ROLLOVER_AGE ??
          DEFAULT_ROLLOVER_AGE,
        mappings: {
          properties: {
            "@timestamp": { type: "date" },
            type: { type: "keyword" },
            service_name: { type: "keyword" },
            environment: { type: "keyword" },
            trace_id: { type: "keyword" },
            span_id: { type: "keyword" },
            parent_span_id: { type: "keyword" },
            name: { type: "keyword" },
            kind: { type: "keyword" },
            duration_ms: { type: "double" },
            status: { type: "keyword" },
            http_method: { type: "keyword" },
            http_path: { type: "keyword" },
            http_status_code: { type: "integer" },
            labels: { type: "object", dynamic: true },
            ingestedAt: { type: "date" },
          },
        },
      },
      apmRollupMetrics: {
        key: "apmRollupMetrics",
        dataStream: rollupStream,
        templateName:
          process.env.ELASTICSEARCH_APM_ROLLUP_TEMPLATE ??
          `${rollupStream}-template`,
        ilmPolicyName:
          process.env.ELASTICSEARCH_APM_ROLLUP_ILM_POLICY ??
          `${rollupStream}-ilm-policy`,
        rolloverSize:
          process.env.ELASTICSEARCH_APM_ROLLUP_ROLLOVER_SIZE ??
          DEFAULT_ROLLOVER_SIZE,
        rolloverAge:
          process.env.ELASTICSEARCH_APM_ROLLUP_ROLLOVER_AGE ??
          DEFAULT_ROLLOVER_AGE,
        mappings: {
          properties: {
            "@timestamp": { type: "date" },
            "@timestamp_bucket": { type: "date" },
            bucket_duration_seconds: { type: "integer" },
            service_name: { type: "keyword" },
            environment: { type: "keyword" },
            target: { type: "keyword" },
            request_count: { type: "long" },
            error_count: { type: "long" },
            error_rate: { type: "double" },
            latency_p50_ms: { type: "double" },
            latency_p90_ms: { type: "double" },
            latency_p95_ms: { type: "double" },
            latency_p99_ms: { type: "double" },
            source_window_from: { type: "date" },
            source_window_to: { type: "date" },
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

  async onModuleInit(): Promise<void> {
    for (const config of Object.values(this.configs)) {
      if (this.useIsm) {
        await this.ensureIsmPolicy(config);
      } else {
        await this.ensureIlmPolicy(config);
        await this.ensureTemplate(config);
      }
      await this.ensureDataStream(config);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  // ----- ILM 경로 (Elasticsearch 기본 정책) -----
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
        this.logger.log(`ILM 정책 생성 완료: ${config.ilmPolicyName}`);
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
        this.logger.log(`인덱스 템플릿 생성 완료: ${config.templateName}`);
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
        this.logger.log(`데이터 스트림 생성 완료: ${config.dataStream}`);
      } else {
        throw error;
      }
    }
  }

  // ----- ISM(OpenSearch) 경로 -----
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
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
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
        this.logger.log(`ISM 정책 생성 완료: ${policyName}`);
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
    const templatePath = `/_index_template/${config.templateName}`;
    const payload = {
      index_patterns: [`${config.dataStream}*`, config.dataStream],
      priority: 500,
      data_stream: {},
      template: {
        mappings: config.mappings,
      },
    };

    try {
      await this.client.transport.request(
        {
          method: "PUT",
          path: templatePath,
          body: payload,
        },
        { headers },
      );
      this.logger.log(`ISM 인덱스 템플릿 생성 완료: ${config.templateName}`);
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 409) {
        this.logger.warn(
          `ISM 템플릿이 이미 존재하여 생성을 건너뜀: ${config.templateName}`,
        );
        return;
      }
      throw error;
    }
  }
}
