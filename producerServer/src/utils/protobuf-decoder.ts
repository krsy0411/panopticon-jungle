import { gunzipSync } from 'zlib';

/**
 * Protobuf 데이터 처리 유틸리티
 * OpenTelemetry Protobuf 압축 해제 및 base64 인코딩
 */
export class ProtobufDecoder {
  /**
   * Protobuf 데이터를 압축 해제하고 JSON 형태로 반환
   */
  static processProtobuf(
    buffer: Buffer,
    dataType: 'trace' | 'metric',
  ): {
    type: 'protobuf';
    dataType: 'trace' | 'metric';
    encoding: 'base64';
    data: string;
    size: number;
    decompressedSize?: number;
    timestamp: string;
  } {
    let processedBuffer = buffer;

    // gzip 압축 해제
    if (this.isGzipped(buffer)) {
      processedBuffer = gunzipSync(buffer);
    }

    return {
      type: 'protobuf',
      dataType,
      encoding: 'base64',
      data: processedBuffer.toString('base64'),
      size: buffer.length,
      decompressedSize: processedBuffer.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * gzip 압축 여부 확인
   */
  private static isGzipped(buffer: Buffer): boolean {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }
}
