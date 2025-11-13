/**
 * OpenTelemetry Span 데이터를 간소화된 형태로 변환
 */

interface OtelAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: any;
    kvlistValue?: any;
    bytesValue?: string;
  };
}

interface OtelSpan {
  traceId: string; // base64
  spanId: string; // base64
  parentSpanId?: string; // base64
  name: string;
  kind: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtelAttribute[];
  status?: {
    code?: number;
    message?: string;
  };
}

interface SimplifiedSpan {
  type: 'span';
  timestamp: string;
  service_name: string;
  environment: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  kind: string;
  duration_ms: number;
  status: string;
  http_method?: string;
  http_path?: string;
  http_status_code?: number;
  etc: Record<string, any>;
}

export class SpanTransformer {
  /**
   * base64로 인코딩된 ID를 16진수 문자열로 변환
   */
  private static base64ToHex(base64: string): string {
    if (!base64) return '';
    try {
      const buffer = Buffer.from(base64, 'base64');
      return buffer.toString('hex');
    } catch {
      return base64;
    }
  }

  /**
   * Unix nano timestamp를 ISO 8601 문자열로 변환
   */
  private static nanoToISO(nanoStr: string): string {
    const ms = parseInt(nanoStr) / 1_000_000;
    return new Date(ms).toISOString();
  }

  /**
   * duration을 밀리초로 계산
   */
  private static calculateDuration(startNano: string, endNano: string): number {
    const start = parseInt(startNano);
    const end = parseInt(endNano);
    return (end - start) / 1_000_000; // nano -> ms
  }

  /**
   * OTEL attribute 배열에서 값 추출
   */
  private static getAttributeValue(
    attributes: OtelAttribute[] | undefined,
    key: string,
  ): any {
    if (!attributes) return undefined;

    const attr = attributes.find((a) => a.key === key);
    if (!attr) return undefined;

    const value = attr.value;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.intValue !== undefined) return parseInt(String(value.intValue));
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.boolValue !== undefined) return value.boolValue;
    if (value.arrayValue !== undefined) return value.arrayValue;
    if (value.kvlistValue !== undefined) return value.kvlistValue;
    if (value.bytesValue !== undefined) return value.bytesValue;

    return undefined;
  }

  /**
   * SpanKind enum을 문자열로 변환
   */
  private static parseSpanKind(kind: string): string {
    const kindMap: Record<string, string> = {
      SPAN_KIND_UNSPECIFIED: 'UNSPECIFIED',
      SPAN_KIND_INTERNAL: 'INTERNAL',
      SPAN_KIND_SERVER: 'SERVER',
      SPAN_KIND_CLIENT: 'CLIENT',
      SPAN_KIND_PRODUCER: 'PRODUCER',
      SPAN_KIND_CONSUMER: 'CONSUMER',
    };
    return kindMap[kind] || kind;
  }

  /**
   * Status 추출
   */
  private static parseStatus(status: any): string {
    if (!status || !status.code) return 'OK';

    // StatusCode: 0=UNSET, 1=OK, 2=ERROR
    if (status.code === 2 || status.code === '2') return 'ERROR';
    return 'OK';
  }

  /**
   * OpenTelemetry ExportTraceServiceRequest를 SimplifiedSpan 배열로 변환
   */
  static transformTraceData(traceData: any): SimplifiedSpan[] {
    const spans: SimplifiedSpan[] = [];

    if (!traceData.resourceSpans) {
      return spans;
    }

    for (const resourceSpan of traceData.resourceSpans) {
      // resource에서 service.name 추출
      const serviceName =
        this.getAttributeValue(
          resourceSpan.resource?.attributes,
          'service.name',
        ) || 'unknown';

      const environment =
        this.getAttributeValue(
          resourceSpan.resource?.attributes,
          'deployment.environment',
        ) || 'unknown';

      // scopeSpans 순회
      for (const scopeSpan of resourceSpan.scopeSpans || []) {
        // spans 순회
        for (const span of scopeSpan.spans || []) {
          // if (span.kind === 'SPAN_KIND_INTERNAL') {
          //   continue; // 건너뛰기
          // }
          spans.push(this.transformSpan(span, serviceName, environment));
        }
      }
    }

    return spans;
  }

  /**
   * 개별 span 변환
   */
  private static transformSpan(
    span: OtelSpan,
    serviceName: string,
    environment: string,
  ): SimplifiedSpan {
    const traceId = this.base64ToHex(span.traceId);
    const spanId = this.base64ToHex(span.spanId);
    const parentSpanId = span.parentSpanId
      ? this.base64ToHex(span.parentSpanId)
      : null;

    const timestamp = this.nanoToISO(span.startTimeUnixNano);
    const duration = this.calculateDuration(
      span.startTimeUnixNano,
      span.endTimeUnixNano,
    );
    const kind = this.parseSpanKind(span.kind);
    const status = this.parseStatus(span.status);

    // HTTP 관련 속성 추출
    const httpMethod = this.getAttributeValue(span.attributes, 'http.method');
    const httpTarget = this.getAttributeValue(span.attributes, 'http.target');
    const httpRoute = this.getAttributeValue(span.attributes, 'http.route');
    const httpStatusCode = this.getAttributeValue(
      span.attributes,
      'http.status_code',
    );

    // 기본 필드에 포함되지 않은 나머지 속성들
    const etc: Record<string, any> = {};

    if (span.attributes) {
      for (const attr of span.attributes) {
        // 이미 추출한 필드는 제외
        if (
          ![
            'http.method',
            'http.target',
            'http.route',
            'http.status_code',
          ].includes(attr.key)
        ) {
          etc[attr.key] = this.getAttributeValue([attr], attr.key);
        }
      }
    }

    const result: SimplifiedSpan = {
      type: 'span',
      timestamp,
      service_name: serviceName,
      environment,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      name: span.name,
      kind,
      duration_ms: duration,
      status,
      etc,
    };

    // HTTP 필드가 있으면 추가
    if (httpMethod) result.http_method = httpMethod;
    if (httpTarget || httpRoute) result.http_path = httpRoute || httpTarget;
    if (httpStatusCode) result.http_status_code = httpStatusCode;

    return result;
  }
}
