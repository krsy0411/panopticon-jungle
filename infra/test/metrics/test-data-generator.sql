-- 테스트 데이터 생성 스크립트
-- 최근 24시간 동안의 API 메트릭과 시스템 메트릭 데이터 생성

-- 기존 테스트 데이터 삭제 (선택사항)
-- DELETE FROM api_metrics WHERE service = 'test-service';
-- DELETE FROM system_metrics WHERE service = 'test-service';

-- API 메트릭 데이터 생성 (10,000개)
INSERT INTO api_metrics (time, service, endpoint, method, latency_ms, status_code, error_count, request_count)
SELECT
  -- 최근 24시간 동안의 랜덤 시간
  NOW() - (random() * INTERVAL '24 hours'),
  -- 서비스명
  'test-service',
  -- 엔드포인트 (5가지 중 랜덤)
  CASE (random() * 5)::INT
    WHEN 0 THEN '/api/users'
    WHEN 1 THEN '/api/orders'
    WHEN 2 THEN '/api/products'
    WHEN 3 THEN '/api/payments'
    ELSE '/api/auth'
  END,
  -- HTTP 메서드 (4가지 중 랜덤)
  CASE (random() * 4)::INT
    WHEN 0 THEN 'GET'
    WHEN 1 THEN 'POST'
    WHEN 2 THEN 'PUT'
    ELSE 'DELETE'
  END,
  -- 레이턴시 (50ms ~ 500ms, 정규분포)
  50 + (random() * 450)::NUMERIC(10,2),
  -- 상태 코드 (대부분 2xx, 가끔 4xx, 5xx)
  CASE
    WHEN random() < 0.85 THEN 200  -- 85% 성공
    WHEN random() < 0.95 THEN 404  -- 10% 클라이언트 에러
    ELSE 500                        -- 5% 서버 에러
  END,
  -- 에러 카운트
  CASE
    WHEN random() < 0.85 THEN 0
    ELSE 1
  END,
  -- 요청 카운트
  1
FROM generate_series(1, 10000);

-- 시스템 메트릭 데이터 생성 (10,000개)
INSERT INTO system_metrics (
  time, service, pod_name, node_name, namespace,
  cpu_usage_percent, memory_usage_bytes, disk_usage_percent,
  network_rx_bytes, network_tx_bytes
)
SELECT
  -- 최근 24시간 동안의 랜덤 시간
  NOW() - (random() * INTERVAL '24 hours'),
  -- 서비스명
  'test-service',
  -- Pod 이름 (3개 중 랜덤)
  'test-service-' || CASE (random() * 3)::INT
    WHEN 0 THEN 'abc123'
    WHEN 1 THEN 'def456'
    ELSE 'ghi789'
  END,
  -- 노드명
  'node-' || ((random() * 5)::INT + 1),
  -- 네임스페이스
  'production',
  -- CPU 사용률 (20% ~ 80%)
  (20 + random() * 60)::NUMERIC(5,2),
  -- 메모리 사용량 (1GB ~ 4GB in bytes)
  ((1 + random() * 3) * 1024 * 1024 * 1024)::BIGINT,
  -- 디스크 사용률 (30% ~ 70%)
  (30 + random() * 40)::NUMERIC(5,2),
  -- 네트워크 수신 (100KB ~ 10MB)
  ((100 + random() * 9900) * 1024)::BIGINT,
  -- 네트워크 송신 (50KB ~ 5MB)
  ((50 + random() * 4950) * 1024)::BIGINT
FROM generate_series(1, 10000)
ON CONFLICT (time, service, pod_name) DO NOTHING;

-- 데이터 생성 확인
SELECT
  'api_metrics' as table_name,
  COUNT(*) as total_count,
  MIN(time) as oldest_time,
  MAX(time) as newest_time
FROM api_metrics
WHERE service = 'test-service'
UNION ALL
SELECT
  'system_metrics' as table_name,
  COUNT(*) as total_count,
  MIN(time) as oldest_time,
  MAX(time) as newest_time
FROM system_metrics
WHERE service = 'test-service';

-- 요약 통계
SELECT
  'API Metrics Summary' as info,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as status_2xx,
  SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as status_4xx,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as status_5xx,
  ROUND(AVG(latency_ms)::NUMERIC, 2) as avg_latency,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::NUMERIC, 2) as p95_latency
FROM api_metrics
WHERE service = 'test-service';
