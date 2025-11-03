/**
 * 시스템 메트릭 데이터 인터페이스
 * CPU, 메모리, 디스크, 네트워크 등 인프라 메트릭
 */
export interface SystemMetricData {
  // 기본 정보
  service: string;
  timestamp: number; // Unix timestamp (ms)
  podName?: string;
  nodeName?: string;
  namespace?: string;

  // CPU 메트릭 (현재 사용)
  cpuUsagePercent?: number; // CPU 사용률 (%)
  cpuCoresUsed?: number; // 사용 중인 CPU 코어 수

  // 메모리 메트릭 (향후 확장)
  memoryUsageBytes?: number; // 메모리 사용량 (bytes)
  memoryUsagePercent?: number; // 메모리 사용률 (%)
  memoryLimitBytes?: number; // 메모리 제한 (bytes)

  // 디스크 메트릭 (향후 확장)
  diskUsagePercent?: number; // 디스크 사용률 (%)
  diskUsageBytes?: number; // 디스크 사용량 (bytes)
  diskIoReadBytes?: number; // 디스크 읽기 (bytes)
  diskIoWriteBytes?: number; // 디스크 쓰기 (bytes)

  // 네트워크 메트릭 (향후 확장)
  networkRxBytes?: number; // 네트워크 수신 (bytes)
  networkTxBytes?: number; // 네트워크 송신 (bytes)
  networkRxPackets?: number; // 네트워크 수신 패킷
  networkTxPackets?: number; // 네트워크 송신 패킷

  // 확장 가능한 메타데이터
  metadata?: Record<string, unknown>;
}

/**
 * TimescaleDB 레코드 인터페이스
 */
export interface SystemMetricRecord {
  time: Date;
  service: string;
  pod_name?: string;
  node_name?: string;
  namespace?: string;

  // CPU
  cpu_usage_percent?: number;
  cpu_cores_used?: number;

  // 메모리
  memory_usage_bytes?: number;
  memory_usage_percent?: number;
  memory_limit_bytes?: number;

  // 디스크
  disk_usage_percent?: number;
  disk_usage_bytes?: number;
  disk_io_read_bytes?: number;
  disk_io_write_bytes?: number;

  // 네트워크
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  network_rx_packets?: number;
  network_tx_packets?: number;

  metadata?: Record<string, unknown>;
}

/**
 * 집계된 시스템 메트릭 인터페이스
 */
export interface AggregatedSystemMetric {
  bucket: Date;
  service: string;
  pod_name?: string;
  node_name?: string;

  // CPU 집계
  avg_cpu_percent?: number;
  max_cpu_percent?: number;
  min_cpu_percent?: number;
  avg_cpu_cores?: number;

  // 메모리 집계
  avg_memory_percent?: number;
  max_memory_percent?: number;
  avg_memory_bytes?: number;

  // 디스크 집계
  avg_disk_percent?: number;
  max_disk_percent?: number;

  // 네트워크 집계
  total_network_rx_bytes?: number;
  total_network_tx_bytes?: number;

  sample_count: number;
}
