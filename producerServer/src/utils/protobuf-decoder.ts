import { gunzipSync } from 'zlib';
import * as root from '@opentelemetry/otlp-transformer/build/esm/generated/root';

/**
 * Protobuf 데이터 처리 유틸리티
 * OpenTelemetry Protobuf 디코딩 및 JSON 변환
 */
export class ProtobufDecoder {
  /**
   * Protobuf 데이터를 디코딩하고 JSON으로 변환
   */
  static processProtobuf(buffer: Buffer): any {
    let decodedBuffer = buffer;
    if (this.isGzipped(buffer)) {
      decodedBuffer = gunzipSync(buffer);
    }
    // Protobuf 디코딩
    try {
      // ExportTraceServiceRequest 디코딩
      const ExportTraceServiceRequest = (root as any).opentelemetry.proto
        .collector.trace.v1.ExportTraceServiceRequest;
      const decoded = ExportTraceServiceRequest.decode(decodedBuffer);
      const json = decoded.toJSON();

      return json;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * gzip 압축 여부 확인
   */
  private static isGzipped(buffer: Buffer): boolean {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }
}
