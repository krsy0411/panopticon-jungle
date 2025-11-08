import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, ProducerRecord } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    // 환경변수에서 MSK 브로커 엔드포인트들을 가져와서 배열로 변환
    const brokers = this.configService.get<string>('MSK_BROKERS')?.split(',');
    // AWS 리전 정보 가져오기
    const region = this.configService.get<string>('AWS_REGION');

    this.kafka = new Kafka({
      clientId: 'panopticon-producer',
      brokers,
      ssl: true,
      sasl: {
        mechanism: 'oauthbearer',
        oauthBearerProvider: async () => {
          const { generateAuthToken } = await import(
            'aws-msk-iam-sasl-signer-js'
          );

          const authTokenResponse = await generateAuthToken({
            region: 'ap-northeast-2',
          });

          return {
            value: authTokenResponse.token,
          };
        },
      },
    } as any);

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });

    this.logger.log(`Kafka configured for region: ${region}`);
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

  async sendMessage(
    topic: string,
    messages: Array<{ key?: string; value: string }>,
  ) {
    if (!this.isConnected) {
      throw new Error('Kafka Producer is not connected');
    }

    try {
      const record: ProducerRecord = {
        topic,
        messages: messages.map((msg) => ({
          key: msg.key,
          value: msg.value,
        })),
      };

      const result = await this.producer.send(record);
      this.logger.debug(`Message sent to topic ${topic}:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }

  async sendLogMessage(logData: any) {
    const topic =
      this.configService.get<string>('MSK_TOPIC') || 'panopticon-logs';
    const message = {
      key: logData.id || Date.now().toString(),
      value: JSON.stringify(logData),
    };

    return this.sendMessage(topic, [message]);
  }

  isProducerConnected(): boolean {
    return this.isConnected;
  }
}
