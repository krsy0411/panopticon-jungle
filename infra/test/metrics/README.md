# Metrics API 테스트 가이드

## 개요

대시보드 메트릭 API (`/metrics/summary`, `/metrics/timeseries`)의 성능과 정확성을 검증하기 위한 테스트 스크립트입니다.

---

## 사전 요구사항

### 1. TimescaleDB 실행 확인

```bash
# TimescaleDB 컨테이너 상태 확인
docker ps | grep timescale

# 또는 PostgreSQL 연결 테스트
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -c "SELECT 1;"
```

### 2. NestJS 백엔드 서버 실행

```bash
cd backend

# 서버 시작
npm run start:dev
```

서버가 정상적으로 시작되면 다음과 같은 로그가 출력됩니다:
```
[Nest] LOG [RouterExplorer] Mapped {/metrics/summary, GET} route
[Nest] LOG [RouterExplorer] Mapped {/metrics/timeseries, GET} route
[Nest] LOG [NestApplication] Nest application successfully started
```

### 3. 필수 도구 설치

```bash
# jq (JSON 파싱 도구)
brew install jq

# PostgreSQL client (psql)
brew install postgresql
```

---

## 테스트 실행

### 방법 1: 자동 테스트 스크립트 실행

테스트 데이터 생성부터 API 검증까지 자동으로 수행합니다.

```bash
cd infra/test/metrics

# 환경 변수 설정 및 테스트 실행
export TIMESCALE_HOST=localhost
export TIMESCALE_PORT=5433
export TIMESCALE_DATABASE=panopticon
export TIMESCALE_USER=admin
export TIMESCALE_PASSWORD=admin123

# 스크립트 실행
./test-metrics-endpoints.sh
```

**예상 출력:**
```
================================================
  Metrics API Endpoint Test Script
================================================

[1/4] Generating 10,000 test data...
✓ Test data generated successfully
  Time taken: 347ms
  API metrics created: 10000
  System metrics created: 10000

[2/4] Checking server status...
✓ Server is running

[3/4] Testing GET /api/metrics/summary
✓ Request successful (HTTP 200)
  Response time: 0.003719s
  Total elapsed: 26ms

[4/4] Testing GET /api/metrics/timeseries
✓ Request successful (HTTP 200)
  Response time: 0.009797s
  Total elapsed: 33ms
```

---

### 방법 2: 수동 테스트 (단계별)

#### Step 1: 테스트 데이터 생성

```bash
cd infra/test/metrics

# SQL 스크립트로 10,000개 데이터 생성
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -f test-data-generator.sql
```

**생성되는 데이터:**
- API 메트릭: 10,000개 (최근 24시간)
- 시스템 메트릭: 10,000개 (최근 24시간)
- 서비스명: `test-service`

#### Step 2: 데이터 생성 확인

```bash
# 데이터 개수 확인
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -c "
  SELECT 'api_metrics' as table_name, COUNT(*) FROM api_metrics WHERE service = 'test-service'
  UNION ALL
  SELECT 'system_metrics', COUNT(*) FROM system_metrics WHERE service = 'test-service';
"
```

**예상 출력:**
```
  table_name   | count
---------------+-------
 api_metrics   | 10000
 system_metrics| 10000
```

#### Step 3: API 엔드포인트 테스트

**1) Summary 엔드포인트**

```bash
# 기본 요청
curl -s http://localhost:3001/metrics/summary | jq .

# 응답 시간 측정
time curl -s http://localhost:3001/metrics/summary | jq .
```

**예상 응답:**
```json
{
  "status_2xx": 8524,
  "status_4xx": 1413,
  "status_5xx": 82,
  "request_per_min": 450,
  "p95_latency": 476
}
```

**2) Timeseries 엔드포인트**

```bash
# 12시간, 5분 간격
curl -s "http://localhost:3001/metrics/timeseries?range=12h&interval=5m" | jq '{range, interval, count: (.data | length)}'

# 24시간, 1시간 간격
curl -s "http://localhost:3001/metrics/timeseries?range=24h&interval=1h" | jq '{range, interval, count: (.data | length)}'

# 6시간, 1분 간격
curl -s "http://localhost:3001/metrics/timeseries?range=6h&interval=1m" | jq '{range, interval, count: (.data | length)}'
```

**예상 응답 (12h, 5m):**
```json
{
  "range": "12h",
  "interval": "5m",
  "data_count": 145,
  "first": {
    "timestamp": "2025-11-03T16:20:00.000Z",
    "requests": 37,
    "errors": 13.51,
    "cpu": 48.24,
    "memory": 2.46
  }
}
```

---

## 성능 벤치마크

### 응답 시간 측정

```bash
# Summary 엔드포인트 10회 측정
for i in {1..10}; do
  time curl -s http://localhost:3001/metrics/summary > /dev/null
done

# Timeseries 엔드포인트 측정
time curl -s "http://localhost:3001/metrics/timeseries?range=12h&interval=5m" > /dev/null
```

### 대용량 데이터 테스트

```bash
# 100,000개 데이터 생성 (test-data-generator.sql 수정 필요)
# generate_series(1, 10000) -> generate_series(1, 100000)

# 응답 시간 측정
time curl -s http://localhost:3001/metrics/summary | jq .
```

---

## 테스트 데이터 정리

### 테스트 데이터만 삭제

```bash
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -c "
  DELETE FROM api_metrics WHERE service = 'test-service';
  DELETE FROM system_metrics WHERE service = 'test-service';
"
```

### 삭제 확인

```bash
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -c "
  SELECT COUNT(*) FROM api_metrics WHERE service = 'test-service';
"
```

---

## 예상 성능 지표

| 항목 | 데이터 개수 | 응답 시간 | 목표 |
|------|------------|----------|------|
| Summary API | 20,000개 | ~30ms | < 500ms |
| Timeseries (12h, 5m) | 20,000개 | ~40ms | < 500ms |
| Timeseries (24h, 1h) | 20,000개 | ~56ms | < 500ms |
| Timeseries (6h, 1m) | 20,000개 | ~25ms | < 500ms |
| 데이터 생성 | 10,000개 | ~347ms | - |

**목표 대비 성능:** 10~16배 빠름 ✅

---

## 트러블슈팅

### 1. 서버가 실행되지 않음

```bash
# 포트 충돌 확인
lsof -ti:3001

# 포트 사용 중인 프로세스 종료
lsof -ti:3001 | xargs kill -9

# 서버 재시작
npm run start:dev
```

### 2. TimescaleDB 연결 실패

```bash
# 환경 변수 확인
cat backend/.env | grep TIMESCALE

# TimescaleDB 컨테이너 재시작
cd infra
docker-compose down
docker-compose up -d
```

### 3. 테이블이 없음 (relation does not exist)

```bash
# 테이블 생성 스크립트 실행
cd infra/test/metrics
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -f init_metrics_tables.sql
```

### 4. jq 명령어를 찾을 수 없음

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# jq 없이 테스트
curl -s http://localhost:3001/metrics/summary
```

---

## 파일 구조

```
infra/test/metrics/
├── init_metrics_tables.sql       # 테이블 생성 SQL
├── test-data-generator.sql       # 테스트 데이터 생성 SQL (10,000개)
├── test-metrics-endpoints.sh     # 자동 테스트 스크립트
└── README.md                      # 이 문서

backend/
└── src/metrics/                   # 메트릭 API 구현
    ├── metrics.controller.ts      # /metrics/summary, /metrics/timeseries
    ├── metrics.service.ts
    ├── api-metrics.repository.ts
    └── system-metrics.repository.ts
```

---

## 추가 테스트 시나리오

### 1. 다양한 range/interval 조합

```bash
# 1시간, 1분 간격 (60개 데이터 포인트)
curl -s "http://localhost:3001/metrics/timeseries?range=1h&interval=1m" | jq '.data | length'

# 7일, 1시간 간격 (168개 데이터 포인트)
curl -s "http://localhost:3001/metrics/timeseries?range=7d&interval=1h" | jq '.data | length'

# 30일, 1일 간격 (30개 데이터 포인트)
curl -s "http://localhost:3001/metrics/timeseries?range=30d&interval=1d" | jq '.data | length'
```

### 2. 병렬 요청 테스트

```bash
# 10개 동시 요청
for i in {1..10}; do
  curl -s http://localhost:3001/metrics/summary > /dev/null &
done
wait
```

### 3. 데이터 정확성 검증

```bash
# Summary 응답 검증
response=$(curl -s http://localhost:3001/metrics/summary)
echo "$response" | jq -e '.status_2xx > 0 and .p95_latency > 0' && echo "✓ Valid data" || echo "✗ Invalid data"

# Timeseries 데이터 포인트 개수 검증
count=$(curl -s "http://localhost:3001/metrics/timeseries?range=12h&interval=5m" | jq '.data | length')
[[ $count -gt 0 ]] && echo "✓ $count data points returned" || echo "✗ No data"
```

---

## 참고 자료

- [TimescaleDB time_bucket() 문서](https://docs.timescale.com/api/latest/hyperfunctions/time_bucket/)
- [PostgreSQL PERCENTILE_CONT() 문서](https://www.postgresql.org/docs/current/functions-aggregate.html)
- [NestJS Testing 가이드](https://docs.nestjs.com/fundamentals/testing)

---

**최종 수정일:** 2025-11-04
**테스트 환경:** macOS, TimescaleDB 2.x, PostgreSQL 16, Node.js 23
