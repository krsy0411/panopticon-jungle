import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

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
   * 입력: @timestamp, timestamp, time (문자열 또는 숫자)
   */
  @IsNumber()
  @Transform(({ obj }) => {
    const value = obj["@timestamp"] ?? obj.timestamp ?? obj.time;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = new Date(value).getTime();
      return isNaN(parsed) ? Date.now() : parsed;
    }
    return Date.now();
  })
  timestamp!: number;

  /**
   * 서비스명 (예: "user-api", "payment-service")
   */
  @IsString()
  @IsNotEmpty()
  service!: string;

  /**
   * Pod 이름 (Kubernetes pod name)
   * 선택적 필드 - 시스템 레벨 메트릭에서는 미제공 가능
   */
  @IsString()
  @IsOptional()
  podName?: string;

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
   * TimescaleDB의 cpu_usage_percent 컬럼에 매핑됨
   */
  @IsNumber()
  @IsOptional()
  cpuUsagePercent?: number;

  /**
   * 메모리 사용량 (bytes, 소수점 지원)
   * 예: 52428800 = 50MB 사용 중
   * TimescaleDB의 memory_usage_bytes 컬럼에 매핑됨
   */
  @IsNumber()
  @IsOptional()
  memoryUsageBytes?: number;

  /**
   * 디스크 사용률 (%, 0-100, 소수점 지원)
   * 예: 65.1 = 디스크 65.1% 사용 중
   * TimescaleDB의 disk_usage_percent 컬럼에 매핑됨
   */
  @IsNumber()
  @IsOptional()
  diskUsagePercent?: number;

  /**
   * 네트워크 수신 바이트 (bytes, 소수점 지원)
   * 예: 1024000 = 1MB 수신
   * TimescaleDB의 network_rx_bytes 컬럼에 매핑됨
   */
  @IsNumber()
  @IsOptional()
  networkRxBytes?: number;

  /**
   * 네트워크 송신 바이트 (bytes, 소수점 지원)
   * 예: 512000 = 512KB 송신
   * TimescaleDB의 network_tx_bytes 컬럼에 매핑됨
   */
  @IsNumber()
  @IsOptional()
  networkTxBytes?: number;

  /**
   * 추가 메타데이터 (JSON 형식)
   * 예: { "region": "us-east-1", "version": "1.2.3" }
   */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
