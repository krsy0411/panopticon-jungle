import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Kafka, type Producer } from "kafkajs";
import { LogEventDto } from "../../shared/apm/logs/dto/log-event.dto";
import {
  getKafkaSecurityOverrides,
  parseKafkaBrokers,
} from "../../shared/common/kafka/kafka.config";

/**
 * 로그 중 ERROR 레벨 이벤트를 별도 Kafka 토픽으로 전달하는 책임을 분리한 서비스
 */
@Injectable()
export class ErrorLogForwarderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErrorLogForwarderService.name);
  private producer?: Producer;

  private readonly topic =
    process.env.KAFKA_APM_LOG_ERROR_TOPIC ?? "apm.logs.error";
  private readonly clientId =
    process.env.KAFKA_APM_LOG_ERROR_CLIENT_ID ??
    "log-consumer-error-forwarder";

  private readonly kafka = new Kafka({
    clientId: this.clientId,
    brokers: parseKafkaBrokers(),
    ...getKafkaSecurityOverrides(),
  });

  async onModuleInit(): Promise<void> {
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });

    try {
      await this.producer.connect();
      this.logger.log(
        `ERROR 로그 포워더가 Kafka에 연결되었습니다. topic=${this.topic} clientId=${this.clientId}`,
      );
    } catch (error) {
      this.logger.error(
        "ERROR 로그 포워더 Kafka 연결에 실패했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
      this.producer = undefined;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }

  /**
   * ERROR 레벨 로그만 별도 Kafka 토픽으로 전달한다.
   * 전송 실패는 기존 ingest 흐름에 영향을 주지 않도록 내부에서 처리한다.
   */
  async forward(dto: LogEventDto): Promise<void> {
    if (dto.level !== "ERROR") {
      return;
    }
    if (!this.producer) {
      this.logger.warn(
        "ERROR 로그 포워더 producer가 초기화되지 않아 전송을 건너뜁니다.",
      );
      return;
    }

    try {
      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: dto.service_name,
            value: JSON.stringify(dto),
          },
        ],
      });
    } catch (error) {
      this.logger.error(
        "ERROR 로그 이벤트 추가 게시에 실패했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
