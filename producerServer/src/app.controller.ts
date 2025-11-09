import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
// import { KafkaService } from './kafka/kafka.service'; // 임시 비활성화
import { S3Service } from './s3/s3.service';
import { OpenSearchService } from './opensearch/opensearch.service';
import { RdbService } from './rdb/rdb.service';
import { TsdbService } from './tsdb/tsdb.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    // private readonly kafkaService: KafkaService, // 임시 비활성화
    private readonly s3Service: S3Service,
    private readonly openSearchService: OpenSearchService,
    private readonly rdbService: RdbService,
    private readonly tsdbService: TsdbService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async healthCheck() {
    // const isKafkaConnected = this.kafkaService.isProducerConnected(); // 임시 비활성화
    const isS3Connected = await this.s3Service.checkConnection();
    const isOpenSearchConnected =
      await this.openSearchService.checkConnection();
    const isRdbConnected = await this.rdbService.checkConnection();
    const isTsdbConnected = await this.tsdbService.checkConnection();

    return {
      timestamp: new Date().toISOString(),
      service: {
        // kafka: isKafkaConnected, // 임시 비활성화
        s3: isS3Connected,
        opensearch: isOpenSearchConnected,
        rdb: isRdbConnected,
        tsdb: isTsdbConnected,
      },
    };
  }

  @Get('opensearch/cluster-health')
  async getOpenSearchClusterHealth() {
    try {
      const health = await this.openSearchService.getClusterHealth();
      return {
        success: true,
        data: health,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
