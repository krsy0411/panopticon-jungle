import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

/**
 * 시스템 메트릭 생성 DTO
 * 주요 메트릭: CPU, Memory, Disk, Network
 *
 * @description
 * Kafka를 통해 수집된 시스템 메트릭을 TimescaleDB에 저장하기 위한 DTO
 * 모든 숫자 필드는 소수점을 지원합니다 (DOUBLE PRECISION)
 */
export class CreateSystemMetricDto {
  /**
   * 메트릭 수집 시각 (Unix timestamp, milliseconds)
   * 미제공시 현재 시각 사용
   */
  @IsOptional()
  @IsNumber()
  timestamp?: number;

  /**
   * 서비스명 (예: "user-api", "payment-service")
   */
  @IsString()
  @IsNotEmpty()
  service!: string;

  /**
   * Pod 이름 (Kubernetes pod name)
   */
  @IsString()
  @IsNotEmpty()
  podName!: string;

  /**
   * 노드명 (Kubernetes node name)
   */
  @IsString()
  @IsOptional()
  nodeName?: string;

  /**
   * 네임스페이스 (Kubernetes namespace, 예: "production", "default")
   */
  @IsString()
  @IsOptional()
  namespace?: string;

  /**
   * CPU 사용률 (%, 0-100, 소수점 지원)
   * 예: 45.5 = CPU 45.5% 사용 중
   */
  @IsNumber()
  @IsOptional()
  cpu?: number;

  /**
   * 메모리 사용률 (%, 0-100, 소수점 지원)
   * 예: 52.3 = 메모리 52.3% 사용 중
   */
  @IsNumber()
  @IsOptional()
  memory?: number;

  /**
   * 디스크 사용률 (%, 0-100, 소수점 지원)
   * 예: 65.1 = 디스크 65.1% 사용 중
   */
  @IsNumber()
  @IsOptional()
  disk?: number;

  /**
   * 네트워크 수신 바이트 (bytes, 소수점 지원)
   * 예: 1024000 = 1MB 수신
   */
  @IsNumber()
  @IsOptional()
  networkIn?: number;

  /**
   * 네트워크 송신 바이트 (bytes, 소수점 지원)
   * 예: 512000 = 512KB 송신
   */
  @IsNumber()
  @IsOptional()
  networkOut?: number;

  /**
   * 추가 메타데이터 (JSON 형식)
   * 예: { "region": "us-east-1", "version": "1.2.3" }
   */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
