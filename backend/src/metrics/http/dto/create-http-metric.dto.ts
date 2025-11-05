import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

/**
 * HTTP 메트릭 생성 DTO
 * HTTP 로그를 집계하여 TimescaleDB에 저장하기 위한 DTO
 */
export class CreateHttpMetricDto {
  /**
   * 메트릭 수집 시각 (Unix timestamp, milliseconds)
   * 미제공 시 현재 시각 사용
   * TimescaleDB의 timestamp 컬럼에 매핑됨
   * 입력 필드명: @timestamp, timestamp, time (하위 호환성)
   */
  @IsOptional()
  @IsNumber()
  @Transform(({ obj }) => obj["@timestamp"] ?? obj.timestamp ?? obj.time)
  timestamp?: number;

  /**
   * 서비스명 (예: "user-api", "payment-service")
   */
  @IsString()
  @IsNotEmpty()
  service!: string;

  /**
   * 요청 수
   * 1분 단위 윈도우 내의 총 HTTP 요청 수
   */
  @IsNumber()
  @IsNotEmpty()
  requests!: number;

  /**
   * 에러율 (%, 0-100)
   * 4xx, 5xx 응답의 비율
   * 예: 5.5 = 5.5% 에러율
   */
  @IsNumber()
  @IsNotEmpty()
  errors!: number;
}
