import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { MetricsHttpDto } from '../dto/metrics-http.dto';
import { SpanDto } from '../dto/spans.dto';

@Controller()
export class KafkaController {
  private readonly logger = new Logger(KafkaController.name);

  constructor(private readonly kafkaService: KafkaService) {}

  // 로그 수집 API
  @Post('logs')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestLogs(@Body() data: any) {
    try {
      console.log('========== TRACE DEBUG ==========');
      console.log('Raw body type:', typeof data);
      console.log('Raw body:', JSON.stringify(data));
      console.log('Body size:', JSON.stringify(data).length, 'bytes');
      console.log('Is Array:', Array.isArray(data));
      console.log('=================================');
      // await this.kafkaService.sendLogs(logs);
      return {
        success: true,
        count: data.length,
        message: 'Logs ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest logs', error);
      throw error;
    }
  }

  @Post('metrics')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestMetricsHttp(@Body() data: MetricsHttpDto | MetricsHttpDto[]) {
    try {
      const metrics = Array.isArray(data) ? data : [data];
      await this.kafkaService.sendMetrics(metrics);

      this.logger.log(`Ingested ${metrics.length} HTTP metric(s)`);
      return {
        success: true,
        count: metrics.length,
        message: 'HTTP metrics ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest HTTP metrics', error);
      throw error;
    }
  }

  @Post('traces')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestSpans(@Body() data: SpanDto | SpanDto[]) {
    try {
      const spans = Array.isArray(data) ? data : [data];
      await this.kafkaService.sendTraces(spans);

      this.logger.log(`Ingested ${spans.length} span(s)`);
      return {
        success: true,
        count: spans.length,
        message: 'Spans ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest spans', error);
      throw error;
    }
  }
}
