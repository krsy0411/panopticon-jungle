import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { KafkaService } from '../kafka/kafka.service';
import { LogDto } from '../dto/logs.dto';
import { MetricsHttpDto } from '../dto/metrics-http.dto';
import { MetricsSystemDto } from '../dto/metrics-system.dto';
import { SpanDto } from '../dto/spans.dto';

@Controller('data')
export class DataController {
  private readonly logger = new Logger(DataController.name);

  constructor(private readonly kafkaService: KafkaService) {}

  @Post('logs')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestLogs(@Body() data: LogDto | LogDto[]) {
    try {
      const logs = Array.isArray(data) ? data : [data];
      await this.kafkaService.sendLogs(logs);

      this.logger.log(`Ingested ${logs.length} log(s)`);
      return {
        success: true,
        count: logs.length,
        message: 'Logs ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest logs', error);
      throw error;
    }
  }

  @Post('metrics/http')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestMetricsHttp(@Body() data: MetricsHttpDto | MetricsHttpDto[]) {
    try {
      const metrics = Array.isArray(data) ? data : [data];
      await this.kafkaService.sendMetricsHttp(metrics);

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

  @Post('metrics/system')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestMetricsSystem(
    @Body() data: MetricsSystemDto | MetricsSystemDto[],
  ) {
    try {
      const metrics = Array.isArray(data) ? data : [data];
      await this.kafkaService.sendMetricsSystem(metrics);

      this.logger.log(`Ingested ${metrics.length} system metric(s)`);
      return {
        success: true,
        count: metrics.length,
        message: 'System metrics ingested successfully',
      };
    } catch (error) {
      this.logger.error('Failed to ingest system metrics', error);
      throw error;
    }
  }

  @Post('spans')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestSpans(@Body() data: SpanDto | SpanDto[]) {
    try {
      const spans = Array.isArray(data) ? data : [data];
      await this.kafkaService.sendSpans(spans);

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
