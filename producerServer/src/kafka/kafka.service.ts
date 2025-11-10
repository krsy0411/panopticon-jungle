import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, ProducerRecord, CompressionTypes } from 'kafkajs';

// 토픽별 설정
interface TopicConfig {
  topic: string;
  acks: number; // 0, 1, or -1(all)
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  // 토픽별 설정 정의
  private readonly topicConfigs: Record<string, TopicConfig> = {
    logs: {
      topic: this.configService.get<string>('KAFKA_TOPIC_LOGS') || 'logs',
      acks: 1, // 리더 확인
    },
    'metrics-http': {
      topic:
        this.configService.get<string>('KAFKA_TOPIC_METRICS_HTTP') ||
        'metrics-http',
      acks: 0, // 확인 없음 (고빈도/비중요)
    },
    'metrics-system': {
      topic:
        this.configService.get<string>('KAFKA_TOPIC_METRICS_SYSTEM') ||
        'metrics-system',
      acks: 0, // 확인 없음 (고빈도/비중요)
    },
    spans: {
      topic: this.configService.get<string>('KAFKA_TOPIC_SPANS') || 'spans',
      acks: 1, // 리더 확인 (tracing 중요)
    },
  };

  constructor(private readonly configService: ConfigService) {
    const client =
      this.configService.get<string>('MSK_CLIENT') || 'panopticon-producer';
    // 환경변수에서 MSK 브로커 엔드포인트들을 가져와서 배열로 변환
    const brokers = this.configService
      .get<string>('MSK_BROKERS')
      ?.split(',') || ['localhost:9094'];
    // AWS 리전 정보 가져오기
    const region = this.configService.get<string>('AWS_REGION');
    // 환경 구분 (development = 로컬 카프카, production = MSK)
    const isProduction = process.env.NODE_ENV === 'production';

    // 로컬 개발 환경: PLAINTEXT 연결
    // 배포 환경: MSK IAM 인증 사용
    this.kafka = new Kafka({
      clientId: client,
      brokers,
      ...(isProduction && {
        ssl: true,
        sasl: {
          mechanism: 'oauthbearer',
          oauthBearerProvider: async () => {
            const { generateAuthToken } = await import(
              'aws-msk-iam-sasl-signer-js'
            );

            const authTokenResponse = await generateAuthToken({
              region: region || 'ap-northeast-2',
            });

            return {
              value: authTokenResponse.token,
            };
          },
        },
      }),
    } as any);

    // Producer 성능 최적화 설정
    const compression =
      this.configService.get<string>('KAFKA_COMPRESSION') || 'snappy';
    const batchSize = parseInt(
      this.configService.get<string>('KAFKA_BATCH_SIZE') || '16384',
      10,
    );
    const lingerMs = parseInt(
      this.configService.get<string>('KAFKA_LINGER_MS') || '10',
      10,
    );

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: !isProduction, // 로컬에서는 자동 토픽 생성 허용
      transactionTimeout: 30000,
      // 성능 최적화 설정
      retry: {
        retries: 3, // 재시도 3회
        initialRetryTime: 100,
        multiplier: 2,
        maxRetryTime: 30000,
      },
      // Batch 설정
      // compression:
      //   CompressionTypes[
      //     compression.toUpperCase() as keyof typeof CompressionTypes
      //   ] || CompressionTypes.Snappy,
    });

    this.logger.log(
      `Kafka configured for ${isProduction ? 'production (MSK)' : 'development (local)'} in region: ${region}`,
    );
    this.logger.log(
      `Producer settings - compression: ${compression}, batchSize: ${batchSize}, lingerMs: ${lingerMs}`,
    );
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka Producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Kafka Producer', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      this.logger.log('Kafka Producer disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect Kafka Producer', error);
    }
  }

  /**
   * 토픽별 설정을 적용하여 메시지 전송
   */
  private async sendMessage(
    topicKey: string,
    messages: Array<{ key?: string; value: string }>,
  ) {
    if (!this.isConnected) {
      throw new Error('Kafka Producer is not connected');
    }

    const config = this.topicConfigs[topicKey];
    if (!config) {
      throw new Error(`Unknown topic key: ${topicKey}`);
    }

    try {
      const record: ProducerRecord = {
        topic: config.topic,
        acks: config.acks,
        messages: messages.map((msg) => ({
          key: msg.key,
          value: msg.value,
        })),
      };

      const result = await this.producer.send(record);
      this.logger.debug(
        `Message sent to topic ${config.topic} (acks=${config.acks}):`,
        result,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${config.topic}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Logs 데이터 전송 (acks=1)
   */
  async sendLogs(logData: any | any[]) {
    const logs = Array.isArray(logData) ? logData : [logData];
    const messages = logs.map((log) => ({
      key: log.id || log.timestamp || Date.now().toString(),
      value: JSON.stringify(log),
    }));

    return this.sendMessage('logs', messages);
  }

  /**
   * HTTP Metrics 데이터 전송 (acks=0, 고빈도)
   */
  async sendMetricsHttp(metricData: any | any[]) {
    const metrics = Array.isArray(metricData) ? metricData : [metricData];
    const messages = metrics.map((metric) => ({
      key: metric.id || Date.now().toString(),
      value: JSON.stringify(metric),
    }));

    return this.sendMessage('metrics-http', messages);
  }

  /**
   * System Metrics 데이터 전송 (acks=0, 고빈도)
   */
  async sendMetricsSystem(metricData: any | any[]) {
    const metrics = Array.isArray(metricData) ? metricData : [metricData];
    const messages = metrics.map((metric) => ({
      key: metric.id || Date.now().toString(),
      value: JSON.stringify(metric),
    }));

    return this.sendMessage('metrics-system', messages);
  }

  /**
   * Spans 데이터 전송 (acks=1, tracing 중요)
   */
  async sendSpans(spanData: any | any[]) {
    const spans = Array.isArray(spanData) ? spanData : [spanData];
    const messages = spans.map((span) => ({
      key: span.traceId || span.spanId || Date.now().toString(),
      value: JSON.stringify(span),
    }));

    return this.sendMessage('spans', messages);
  }

  /**
   * 레거시 메서드 (하위 호환성)
   */
  async sendLogMessage(logData: any) {
    return this.sendLogs(logData);
  }

  isProducerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 토픽 설정 조회
   */
  getTopicConfigs() {
    return this.topicConfigs;
  }
}
