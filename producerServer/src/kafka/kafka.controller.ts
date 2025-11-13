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

  @Post('logs/v1/traces')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestLogs(@Body() data: any, @Req() req: any) {
    try {
      const tracesToSend = req.rawBody
        ? [ProtobufDecoder.processProtobuf(req.rawBody, 'trace')]
        : Array.isArray(data)
          ? data
          : [data];
      // await this.kafkaService.sendSpans(tracesToSend);
      this.logger.log(JSON.stringify(tracesToSend, null, 2));
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

  @Post('traces')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestTraces(@Body() data: any, @Req() req: any) {
    try {
      const tracesToSend = req.rawBody
        ? [ProtobufDecoder.processProtobuf(req.rawBody, 'trace')]
        : Array.isArray(data)
          ? data
          : [data];

      await this.kafkaService.sendSpans(tracesToSend);
      this.logger.log(`Ingested ${tracesToSend.length} trace(s)`);
    } catch (error) {
      this.logger.error('Failed to ingest traces', error);
      throw error;
    }
  }
}
