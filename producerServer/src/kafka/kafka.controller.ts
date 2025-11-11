import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { ProtobufDecoder } from '../utils/protobuf-decoder';

@Controller()
export class KafkaController {
  private readonly logger = new Logger(KafkaController.name);

  constructor(private readonly kafkaService: KafkaService) {}

  // 로그 수집 API
  @Post('logs')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestLogs(@Body() data: any) {
    try {
      await this.kafkaService.sendLogs(data);
      return;
    } catch (error) {
      this.logger.error('Failed to ingest logs', error);
      throw error;
    }
  }

  @Post('metrics')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestMetricsHttp(@Body() data: any | any[], @Req() req: any) {
    try {
      console.log('========== METRICS DEBUG ==========');
      console.log('Content-Type:', req.headers['content-type']);

      let metricsToSend: any[];

      // Protobuf raw body 처리
      if (req.rawBody) {
        console.log('\n📦 Protobuf Data Detected!');
        const analysis = ProtobufDecoder.analyzeProtobuf(req.rawBody, 'metric');
        console.log('\n📊 Protobuf Analysis:');
        console.log(ProtobufDecoder.formatAnalysis(analysis, 3000));
        console.log('\n');

        // Protobuf를 base64로 인코딩해서 Kafka에 전송
        // Consumer에서 디코딩 필요
        metricsToSend = [
          {
            type: 'protobuf',
            encoding: 'base64',
            data: req.rawBody.toString('base64'),
            size: req.rawBody.length,
            timestamp: new Date().toISOString(),
          },
        ];
      } else {
        console.log('\n📝 JSON Data:');
        console.log('Raw body type:', typeof data);
        console.log('Is Array:', Array.isArray(data));
        console.log('Sample:', JSON.stringify(data).slice(0, 500));

        metricsToSend = Array.isArray(data) ? data : [data];
      }
      console.log('===================================\n');

      await this.kafkaService.sendMetrics(metricsToSend);

      this.logger.log(`Ingested ${metricsToSend.length} metric(s)`);
      return {
        success: true,
        count: metricsToSend.length,
        message: 'Metrics ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest metrics', error);
      throw error;
    }
  }

  @Post('traces')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestTracesHttp(@Body() data: any | any[], @Req() req: any) {
    try {
      console.log('========== TRACES DEBUG ==========');
      console.log('Content-Type:', req.headers['content-type']);

      let tracesToSend: any[];

      // Protobuf raw body 처리
      if (req.rawBody) {
        console.log('\n📦 Protobuf Data Detected!');
        const analysis = ProtobufDecoder.analyzeProtobuf(req.rawBody, 'trace');
        console.log('\n📊 Protobuf Analysis:');
        console.log(ProtobufDecoder.formatAnalysis(analysis, 3000));
        console.log('\n');

        // Protobuf를 base64로 인코딩해서 Kafka에 전송
        // Consumer에서 디코딩 필요
        tracesToSend = [
          {
            type: 'protobuf',
            encoding: 'base64',
            data: req.rawBody.toString('base64'),
            size: req.rawBody.length,
            timestamp: new Date().toISOString(),
          },
        ];
      } else {
        console.log('\n📝 JSON Data:');
        console.log('Raw body type:', typeof data);
        console.log('Is Array:', Array.isArray(data));
        console.log('Sample:', JSON.stringify(data).slice(0, 500));

        tracesToSend = Array.isArray(data) ? data : [data];
      }
      console.log('===================================\n');

      await this.kafkaService.sendSpans(tracesToSend);

      this.logger.log(`Ingested ${tracesToSend.length} trace(s)`);
      return {
        success: true,
        count: tracesToSend.length,
        message: 'Traces ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest traces', error);
      throw error;
    }
  }
}
