import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

/**
 * API 메트릭 생성 DTO
 *
 * @description
 * Kafka를 통해 수집된 API 메트릭을 TimescaleDB에 저장하기 위한 DTO
 * 4 Golden Signals 중 Latency, Traffic, Error를 측정합니다
 * 모든 숫자 필드는 소수점을 지원합니다 (DOUBLE PRECISION)
 */
export class CreateApiMetricDto {
  /**
   * 메트릭 수집 시각 (ISO 8601 형식 또는 Unix timestamp)
   * 예: "2025-11-04T12:00:00Z" 또는 1730716800000
   * 미제공시 현재 시각 사용
   */
  @IsOptional()
  @IsString()
  timestamp?: string;

  /**
   * 서비스명 (예: "user-api", "payment-service")
   */
  @IsString()
  @IsNotEmpty()
  service!: string;

  /**
   * API 엔드포인트 (예: "/api/users", "/api/orders/:id")
   */
  @IsString()
  @IsOptional()
  endpoint?: string;

  /**
   * HTTP 메서드 (예: "GET", "POST", "PUT", "DELETE")
   */
  @IsString()
  @IsOptional()
  method?: string;

  /**
   * API 응답 시간 (밀리초, 소수점 지원)
   * 예: 125.5 = 125.5ms 소요
   * 4 Golden Signals: Latency
   */
  @IsNumber()
  @IsOptional()
  latency?: number;

  /**
   * HTTP 상태 코드 (예: 200, 404, 500)
   * 4 Golden Signals: Error (status >= 500)
   */
  @IsNumber()
  @IsOptional()
  status?: number;

  /**
   * 추가 메타데이터 (JSON 형식)
   * 예: { "user_id": "12345", "trace_id": "abc-123" }
   */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
