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
import { SpanTransformer } from '../utils/span-transformer';

@Controller()
export class KafkaController {
  private readonly logger = new Logger(KafkaController.name);

  constructor(private readonly kafkaService: KafkaService) {}
  @Post('v1/httplogs')
  @HttpCode(HttpStatus.ACCEPTED)
  async getHttpLogs(@Body() data: any) {
    const logData = Array.isArray(data) ? data : [data];
    // console.log('Content-Type:', req.headers['content-type']);
    // console.log(data);
    await this.kafkaService.sendLogs(logData);
    return { success: true };
  }

  @Post('v1/logs')
  @HttpCode(HttpStatus.ACCEPTED)
  async getlogs(@Body() data: any) {
    const logData = Array.isArray(data) ? data : [data];
    await this.kafkaService.sendLogs(logData);

    return { success: true };
  }

  // Otel에서 옴
  @Post('v1/traces')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestLogs(@Body() data: any, @Req() req: any) {
    try {
      let spans: any[];
      console.log('Content-Type:', req.headers['content-type']);
      // Protobuf 디코딩 json형태로 반환
      // 간소화된 span으로 변환
      if (req.rawBody) {
        const decodedTrace = ProtobufDecoder.processProtobuf(req.rawBody);
        spans = SpanTransformer.transformTraceData(decodedTrace);
      } else {
        spans = Array.isArray(data) ? data : [data];
      }

      await this.kafkaService.sendSpans(spans);
      this.logger.log(`Sent ${spans.length} span(s) to Kafka`);
    } catch (error) {
      this.logger.error('Failed to ingest logs', error);
      throw error;
    }
  }
}
