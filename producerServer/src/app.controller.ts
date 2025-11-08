import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { KafkaService } from './kafka/kafka.service';
import { S3Service } from './s3/s3.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly kafkaService: KafkaService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async healthCheck() {
    const isKafkaConnected = this.kafkaService.isProducerConnected();
    const isS3Connected = await this.s3Service.checkConnection();
    return {
      timestamp: new Date().toISOString(),
      service: {
        kafka: isKafkaConnected,
        s3: isS3Connected,
      },
    };
  }
}
