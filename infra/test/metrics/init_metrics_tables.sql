-- 초기 메트릭 테이블 및 뷰 생성 스크립트 : 이건 문법 공부용 예제이므로, 굳이 실행 안 해봐도 됩니다.

-- TimescaleDB 확장 생성
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- API 메트릭 테이블
CREATE TABLE IF NOT EXISTS api_metrics (
    time TIMESTAMPTZ NOT NULL,
    service TEXT NOT NULL,
    endpoint TEXT,
    method TEXT,
    latency_ms DOUBLE PRECISION,
    status_code INTEGER,
    error_count INTEGER DEFAULT 0,
    request_count INTEGER DEFAULT 1,
    metadata JSONB,
    PRIMARY KEY (time, service, endpoint, method)
);

-- API 메트릭을 하이퍼테이블로 변환
SELECT create_hypertable('api_metrics', 'time', if_not_exists => TRUE);

-- 시스템 메트릭 테이블
CREATE TABLE IF NOT EXISTS system_metrics (
    time TIMESTAMPTZ NOT NULL,
    service TEXT NOT NULL,
    pod_name TEXT NOT NULL,
    node_name TEXT,
    namespace TEXT,
    cpu_usage_percent DOUBLE PRECISION,
    cpu_cores_used DOUBLE PRECISION,
    memory_usage_bytes DOUBLE PRECISION,
    memory_usage_percent DOUBLE PRECISION,
    memory_limit_bytes DOUBLE PRECISION,
    disk_usage_percent DOUBLE PRECISION,
    disk_usage_bytes DOUBLE PRECISION,
    disk_io_read_bytes DOUBLE PRECISION,
    disk_io_write_bytes DOUBLE PRECISION,
    network_rx_bytes DOUBLE PRECISION,
    network_tx_bytes DOUBLE PRECISION,
    network_rx_packets DOUBLE PRECISION,
    network_tx_packets DOUBLE PRECISION,
    metadata JSONB,
    PRIMARY KEY (time, service, pod_name)
);

-- 시스템 메트릭을 하이퍼테이블로 변환
SELECT create_hypertable('system_metrics', 'time', if_not_exists => TRUE);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_api_metrics_service_time ON api_metrics (service, time DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics (endpoint, time DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time ON system_metrics (service, time DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_pod_time ON system_metrics (pod_name, time DESC);

-- API 메트릭 집계 뷰 (1분 단위)
DROP VIEW IF EXISTS api_metrics_1min CASCADE;
CREATE VIEW api_metrics_1min AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  service,
  endpoint,
  method,
  COUNT(*) as request_count,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
  ROUND(MAX(latency_ms)::numeric, 2) as max_latency_ms,
  ROUND(MIN(latency_ms)::numeric, 2) as min_latency_ms,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as error_count,
  ROUND((SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100), 2) as error_rate
FROM api_metrics
GROUP BY bucket, service, endpoint, method;

-- API 메트릭 집계 뷰 (5분 단위)
DROP VIEW IF EXISTS api_metrics_5min CASCADE;
CREATE VIEW api_metrics_5min AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  service,
  endpoint,
  method,
  COUNT(*) as request_count,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
  ROUND(MAX(latency_ms)::numeric, 2) as max_latency_ms,
  ROUND(MIN(latency_ms)::numeric, 2) as min_latency_ms,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as error_count,
  ROUND((SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100), 2) as error_rate
FROM api_metrics
GROUP BY bucket, service, endpoint, method;

-- 시스템 메트릭 집계 뷰 (1분 단위)
DROP VIEW IF EXISTS system_metrics_1min CASCADE;
CREATE VIEW system_metrics_1min AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  service,
  pod_name,
  node_name,
  namespace,
  COUNT(*) as sample_count,
  ROUND(AVG(cpu_usage_percent)::numeric, 2) as avg_cpu_usage_percent,
  ROUND(MAX(cpu_usage_percent)::numeric, 2) as max_cpu_usage_percent,
  ROUND(AVG(cpu_cores_used)::numeric, 3) as avg_cpu_cores_used,
  ROUND(AVG(memory_usage_bytes)::numeric, 0) as avg_memory_usage_bytes,
  ROUND(MAX(memory_usage_bytes)::numeric, 0) as max_memory_usage_bytes,
  ROUND(AVG(memory_usage_percent)::numeric, 2) as avg_memory_usage_percent,
  ROUND(AVG(disk_usage_percent)::numeric, 2) as avg_disk_usage_percent,
  ROUND(SUM(network_rx_bytes)::numeric, 0) as total_network_rx_bytes,
  ROUND(SUM(network_tx_bytes)::numeric, 0) as total_network_tx_bytes
FROM system_metrics
GROUP BY bucket, service, pod_name, node_name, namespace;

-- 시스템 메트릭 집계 뷰 (5분 단위)
DROP VIEW IF EXISTS system_metrics_5min CASCADE;
CREATE VIEW system_metrics_5min AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  service,
  pod_name,
  node_name,
  namespace,
  COUNT(*) as sample_count,
  ROUND(AVG(cpu_usage_percent)::numeric, 2) as avg_cpu_usage_percent,
  ROUND(MAX(cpu_usage_percent)::numeric, 2) as max_cpu_usage_percent,
  ROUND(AVG(cpu_cores_used)::numeric, 3) as avg_cpu_cores_used,
  ROUND(AVG(memory_usage_bytes)::numeric, 0) as avg_memory_usage_bytes,
  ROUND(MAX(memory_usage_bytes)::numeric, 0) as max_memory_usage_bytes,
  ROUND(AVG(memory_usage_percent)::numeric, 2) as avg_memory_usage_percent,
  ROUND(AVG(disk_usage_percent)::numeric, 2) as avg_disk_usage_percent,
  ROUND(SUM(network_rx_bytes)::numeric, 0) as total_network_rx_bytes,
  ROUND(SUM(network_tx_bytes)::numeric, 0) as total_network_tx_bytes
FROM system_metrics
GROUP BY bucket, service, pod_name, node_name, namespace;

-- 테스트 데이터 삽입 (API 메트릭)
INSERT INTO api_metrics (time, service, endpoint, method, latency_ms, status_code, error_count, request_count)
VALUES
    (NOW() - INTERVAL '10 minutes', 'test-service', '/api/users', 'GET', 120.5, 200, 0, 1),
    (NOW() - INTERVAL '9 minutes', 'test-service', '/api/users', 'GET', 98.3, 200, 0, 1),
    (NOW() - INTERVAL '8 minutes', 'test-service', '/api/users', 'POST', 250.7, 201, 0, 1),
    (NOW() - INTERVAL '7 minutes', 'test-service', '/api/products', 'GET', 85.2, 200, 0, 1),
    (NOW() - INTERVAL '6 minutes', 'test-service', '/api/products', 'GET', 450.1, 500, 1, 1),
    (NOW() - INTERVAL '5 minutes', 'test-service', '/api/orders', 'POST', 320.8, 201, 0, 1),
    (NOW() - INTERVAL '4 minutes', 'another-service', '/api/auth', 'POST', 180.3, 200, 0, 1),
    (NOW() - INTERVAL '3 minutes', 'another-service', '/api/auth', 'POST', 210.5, 401, 1, 1),
    (NOW() - INTERVAL '2 minutes', 'test-service', '/api/users', 'DELETE', 95.7, 204, 0, 1),
    (NOW() - INTERVAL '1 minute', 'test-service', '/api/users', 'GET', 110.2, 200, 0, 1)
ON CONFLICT (time, service, endpoint, method) DO NOTHING;

-- 테스트 데이터 삽입 (시스템 메트릭)
INSERT INTO system_metrics (
    time, service, pod_name, node_name, namespace,
    cpu_usage_percent, cpu_cores_used,
    memory_usage_bytes, memory_usage_percent, memory_limit_bytes,
    disk_usage_percent, disk_usage_bytes,
    network_rx_bytes, network_tx_bytes
)
VALUES
    (NOW() - INTERVAL '10 minutes', 'test-service', 'test-pod-1', 'node-1', 'default',
     45.5, 0.91, 512000000, 51.2, 1000000000, 65.3, 5000000000, 1024000, 2048000),
    (NOW() - INTERVAL '9 minutes', 'test-service', 'test-pod-1', 'node-1', 'default',
     48.2, 0.96, 520000000, 52.0, 1000000000, 65.5, 5100000000, 1100000, 2100000),
    (NOW() - INTERVAL '8 minutes', 'test-service', 'test-pod-1', 'node-1', 'default',
     52.7, 1.05, 535000000, 53.5, 1000000000, 66.0, 5200000000, 1150000, 2200000),
    (NOW() - INTERVAL '7 minutes', 'test-service', 'test-pod-2', 'node-2', 'default',
     38.3, 0.77, 480000000, 48.0, 1000000000, 60.1, 4800000000, 950000, 1900000),
    (NOW() - INTERVAL '6 minutes', 'test-service', 'test-pod-2', 'node-2', 'default',
     40.1, 0.80, 490000000, 49.0, 1000000000, 61.2, 4900000000, 980000, 1950000),
    (NOW() - INTERVAL '5 minutes', 'another-service', 'another-pod-1', 'node-1', 'production',
     62.5, 1.25, 750000000, 75.0, 1000000000, 70.5, 6000000000, 2000000, 3000000),
    (NOW() - INTERVAL '4 minutes', 'another-service', 'another-pod-1', 'node-1', 'production',
     65.8, 1.32, 780000000, 78.0, 1000000000, 71.2, 6100000000, 2100000, 3100000),
    (NOW() - INTERVAL '3 minutes', 'test-service', 'test-pod-1', 'node-1', 'default',
     50.5, 1.01, 525000000, 52.5, 1000000000, 66.8, 5300000000, 1200000, 2300000),
    (NOW() - INTERVAL '2 minutes', 'test-service', 'test-pod-1', 'node-1', 'default',
     47.3, 0.95, 515000000, 51.5, 1000000000, 67.1, 5350000000, 1220000, 2320000),
    (NOW() - INTERVAL '1 minute', 'test-service', 'test-pod-1', 'node-1', 'default',
     46.8, 0.94, 510000000, 51.0, 1000000000, 67.3, 5400000000, 1230000, 2350000)
ON CONFLICT (time, service, pod_name) DO NOTHING;

-- 데이터 확인
SELECT COUNT(*) as api_metrics_count FROM api_metrics;
SELECT COUNT(*) as system_metrics_count FROM system_metrics;
