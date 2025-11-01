import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, Producer, logLevel } from "kafkajs";

const DEFAULT_CLIENT_ID = "panopticon-backend";
const DEFAULT_BROKERS = ["localhost:9092"];
const DEFAULT_LOG_TOPIC = "logs.raw";

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor() {
    const clientId = process.env.KAFKA_CLIENT_ID ?? DEFAULT_CLIENT_ID;
    const brokersEnv = process.env.KAFKA_BROKERS;
    const brokers = brokersEnv
      ? brokersEnv
          .split(",")
          .map((broker) => broker.trim())
          .filter(Boolean)
      : DEFAULT_BROKERS;

    if (brokers.length === 0) {
      throw new Error("Kafka configuration error: no brokers provided");
    }

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.NOTHING,
      ssl: process.env.KAFKA_SSL === "true",
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation:
        process.env.KAFKA_ALLOW_AUTO_TOPIC_CREATION !== "false",
    });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async emitLog(message: unknown): Promise<void> {
    const topic = process.env.KAFKA_LOG_TOPIC ?? DEFAULT_LOG_TOPIC;

    await this.producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
    });
  }
}
