import { gunzipSync } from 'zlib';

/**
 * Protobuf 데이터를 분석하는 유틸리티
 * OpenTelemetry Protobuf 데이터의 구조를 파악하기 위한 간단한 파서
 */
export class ProtobufDecoder {
  /**
   * Protobuf 데이터를 human-readable 형식으로 분석
   */
  static analyzeProtobuf(buffer: Buffer, dataType: 'trace' | 'metric'): any {
    try {
      const analysis: any = {
        totalBytes: buffer.length,
        hexPreview: buffer.slice(0, 50).toString('hex'),
        base64Preview: buffer.slice(0, 100).toString('base64'),
        isGzipped: this.isGzipped(buffer),
        dataType,
      };

      // gzip 압축 확인 및 해제
      let decodedBuffer = buffer;
      if (analysis.isGzipped) {
        try {
          decodedBuffer = gunzipSync(buffer);
          analysis.decompressedSize = decodedBuffer.length;
          analysis.compressionRatio = (
            (buffer.length / decodedBuffer.length) *
            100
          ).toFixed(2);
          console.log(
            `✅ Gzip decompressed: ${buffer.length} → ${decodedBuffer.length} bytes (${analysis.compressionRatio}% compression)`,
          );
        } catch (error) {
          analysis.decompressionError =
            error instanceof Error ? error.message : 'Unknown error';
          console.error('❌ Gzip decompression failed:', error);
        }
      }

      // OpenTelemetry Protobuf 파싱 시도
      if (dataType === 'trace') {
        try {
          const parsed = this.parseTraceProtobuf(decodedBuffer);
          analysis.parsedData = parsed;
          console.log('\n📊 Parsed Trace Data:');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (error) {
          analysis.parseError =
            error instanceof Error ? error.message : 'Unknown error';
          console.error('❌ Trace parsing failed:', error);
        }
      } else if (dataType === 'metric') {
        try {
          const parsed = this.parseMetricProtobuf(decodedBuffer);
          analysis.parsedData = parsed;
          console.log('\n📊 Parsed Metric Data:');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (error) {
          analysis.parseError =
            error instanceof Error ? error.message : 'Unknown error';
          console.error('❌ Metric parsing failed:', error);
        }
      }

      analysis.wireTypeAnalysis = this.analyzeWireTypes(decodedBuffer);

      // 간단한 문자열 추출 시도
      const strings = this.extractStrings(decodedBuffer);
      if (strings.length > 0) {
        analysis.extractedStrings = strings.slice(0, 20); // 처음 20개만
      }

      return analysis;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        rawLength: buffer.length,
      };
    }
  }

  /**
   * OpenTelemetry Trace Protobuf 파싱
   */
  private static parseTraceProtobuf(buffer: Buffer): any {
    const result: any = {
      dataType: 'trace',
    };

    try {
      const extracted = this.extractKeyValuePairs(buffer);
      const numbers = this.extractNumbers(buffer);

      result.extractedFields = extracted;
      result.numericValues = numbers;

      // Trace 특화 정보
      console.log(`\n🔍 Found ${extracted.allStrings.length} string fields`);
      console.log(`🔢 Found ${numbers.length} numeric values`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * OpenTelemetry Metric Protobuf 파싱
   */
  private static parseMetricProtobuf(buffer: Buffer): any {
    const result: any = {
      dataType: 'metric',
    };

    try {
      const extracted = this.extractKeyValuePairs(buffer);
      const numbers = this.extractNumbers(buffer);

      result.extractedFields = extracted;
      result.numericValues = numbers;

      console.log(`\n🔍 Found ${extracted.allStrings.length} string fields`);
      console.log(`🔢 Found ${numbers.length} numeric values`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * Buffer에서 숫자 값 추출 (varint, fixed32, fixed64)
   */
  private static extractNumbers(buffer: Buffer): number[] {
    const numbers: number[] = [];
    let pos = 0;

    while (pos < buffer.length - 8) {
      // Varint 읽기 시도
      if (buffer[pos] < 128) {
        numbers.push(buffer[pos]);
      }

      // Fixed32 읽기 시도
      if (pos + 4 <= buffer.length) {
        const fixed32 = buffer.readUInt32LE(pos);
        if (fixed32 > 0 && fixed32 < 1e9) {
          // 합리적인 범위
          numbers.push(fixed32);
        }
      }

      // Fixed64 읽기 시도 (timestamp일 가능성)
      if (pos + 8 <= buffer.length) {
        try {
          const fixed64 = buffer.readBigUInt64LE(pos);
          if (fixed64 > 0n && fixed64 < 1e15) {
            numbers.push(Number(fixed64));
          }
        } catch {
          // ignore
        }
      }

      pos++;
    }

    // 중복 제거 및 정렬
    return [...new Set(numbers)].sort((a, b) => a - b).slice(0, 50); // 최대 50개
  }

  /**
   * Protobuf에서 키-값 쌍 추출 (모든 필드)
   */
  private static extractKeyValuePairs(buffer: Buffer): any {
    const pairs: any = {};
    const strings = this.extractStrings(buffer, 2, 500); // 최소 2글자, 최대 500글자

    // 모든 연속된 문자열을 키-값 쌍으로 추출
    for (let i = 0; i < strings.length - 1; i++) {
      const current = strings[i];
      const next = strings[i + 1];

      // 키처럼 보이는 패턴: 점(.)이나 언더스코어(_)가 포함되거나, 알파벳으로만 구성
      const looksLikeKey =
        current.includes('.') ||
        current.includes('_') ||
        /^[a-zA-Z]+$/.test(current);

      if (looksLikeKey) {
        pairs[current] = next;
      }
    }

    return {
      allStrings: strings, // 모든 추출된 문자열
      keyValuePairs: pairs, // 추정된 키-값 쌍
    };
  }

  /**
   * gzip 압축 여부 확인
   */
  private static isGzipped(buffer: Buffer): boolean {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }

  /**
   * Protobuf wire type 분석
   */
  private static analyzeWireTypes(buffer: Buffer): any {
    const analysis: any = {
      fieldCount: 0,
      wireTypes: {} as Record<number, number>,
    };

    let pos = 0;
    while (pos < buffer.length && pos < 1000) {
      // 처음 1000바이트만 분석
      try {
        const byte = buffer[pos];
        const wireType = byte & 0x07;

        analysis.fieldCount++;
        analysis.wireTypes[wireType] = (analysis.wireTypes[wireType] || 0) + 1;

        // Wire type에 따라 다음 필드로 이동
        if (wireType === 0) {
          // Varint
          pos++;
          while (pos < buffer.length && buffer[pos] & 0x80) pos++;
          pos++;
        } else if (wireType === 1) {
          // 64-bit
          pos += 9;
        } else if (wireType === 2) {
          // Length-delimited
          pos++;
          if (pos < buffer.length) {
            const length = buffer[pos];
            pos += length + 1;
          }
        } else if (wireType === 5) {
          // 32-bit
          pos += 5;
        } else {
          pos++;
        }
      } catch {
        break;
      }
    }

    return analysis;
  }

  /**
   * Buffer에서 읽을 수 있는 문자열 추출
   */
  private static extractStrings(
    buffer: Buffer,
    minLength = 3,
    maxLength = 100,
  ): string[] {
    const strings: string[] = [];
    let currentString = '';

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];

      // 출력 가능한 ASCII 문자 (32-126)
      if (byte >= 32 && byte <= 126) {
        currentString += String.fromCharCode(byte);
      } else {
        if (currentString.length >= minLength) {
          strings.push(currentString.substring(0, maxLength));
        }
        currentString = '';
      }
    }

    if (currentString.length >= minLength) {
      strings.push(currentString.substring(0, maxLength));
    }

    return strings;
  }

  /**
   * 디코딩된 데이터를 보기 좋게 포맷팅
   */
  static formatAnalysis(analysis: any, maxLength = 5000): string {
    try {
      const formatted = JSON.stringify(analysis, null, 2);
      if (formatted.length > maxLength) {
        return formatted.substring(0, maxLength) + '\n... (truncated)';
      }
      return formatted;
    } catch {
      return String(analysis);
    }
  }
}
