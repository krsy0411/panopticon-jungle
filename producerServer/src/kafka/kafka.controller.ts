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

  @Post('logs/v1/traces')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestLogs(@Body() data: any, @Req() req: any) {
    try {
      let spans: any[];

      if (req.rawBody) {
        // Protobuf 디코딩 json형태로 반환
        const decodedTrace = ProtobufDecoder.processProtobuf(req.rawBody);
        // 간소화된 span으로 변환
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

  // @Post('metrics')
  // @HttpCode(HttpStatus.ACCEPTED)
  // async ingestMetrics(@Body() data: any, @Req() req: any) {
  //   try {
  //     const metricsToSend = req.rawBody
  //       ? [ProtobufDecoder.processProtobuf(req.rawBody, 'metric')]
  //       : Array.isArray(data)
  //         ? data
  //         : [data];

  //     await this.kafkaService.sendMetrics(metricsToSend);
  //     this.logger.log(`Ingested ${metricsToSend.length} metric(s)`);
  //   } catch (error) {
  //     this.logger.error('Failed to ingest metrics', error);
  //     throw error;
  //   }
  // }
}
