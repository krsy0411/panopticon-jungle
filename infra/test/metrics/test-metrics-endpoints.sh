#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
API_BASE_URL="http://localhost:3001/metrics"
DB_HOST="${TIMESCALE_HOST:-localhost}"
DB_PORT="${TIMESCALE_PORT:-5433}"
DB_NAME="${TIMESCALE_DATABASE:-panopticon}"
DB_USER="${TIMESCALE_USER:-admin}"
DB_PASS="${TIMESCALE_PASSWORD:-admin123}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Metrics API Endpoint Test Script${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. 테스트 데이터 생성
echo -e "${YELLOW}[1/4] Generating 10,000 test data...${NC}"
echo "Connecting to TimescaleDB at ${DB_HOST}:${DB_PORT}/${DB_NAME}"

start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f test-data-generator.sql > /tmp/test-data-output.log 2>&1
end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
elapsed=$((end_time - start_time))

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Test data generated successfully${NC}"
  echo -e "  Time taken: ${elapsed}ms"

  # 생성된 데이터 개수 확인
  api_count=$(PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM api_metrics WHERE service = 'test-service';" | tr -d ' ')
  system_count=$(PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM system_metrics WHERE service = 'test-service';" | tr -d ' ')

  echo -e "  API metrics created: ${GREEN}${api_count}${NC}"
  echo -e "  System metrics created: ${GREEN}${system_count}${NC}"
else
  echo -e "${RED}✗ Failed to generate test data${NC}"
  cat /tmp/test-data-output.log
  exit 1
fi

echo ""

# 2. 서버 상태 확인
echo -e "${YELLOW}[2/4] Checking server status...${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/services")

if [ "$response" = "200" ]; then
  echo -e "${GREEN}✓ Server is running${NC}"
else
  echo -e "${RED}✗ Server is not responding (HTTP ${response})${NC}"
  echo -e "${RED}  Please start the NestJS server first!${NC}"
  exit 1
fi

echo ""

# 3. GET /api/metrics/summary 테스트
echo -e "${YELLOW}[3/4] Testing GET /api/metrics/summary${NC}"
echo "Endpoint: ${API_BASE_URL}/summary"

start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
response=$(curl -s -w "\n%{http_code}\n%{time_total}" "${API_BASE_URL}/summary")
end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')

http_code=$(echo "$response" | tail -2 | head -1)
time_total=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -2)

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ Request successful (HTTP ${http_code})${NC}"
  echo -e "  Response time: ${GREEN}${time_total}s${NC}"
  echo -e "  Total elapsed: ${GREEN}$((end_time - start_time))ms${NC}"
  echo ""
  echo -e "${BLUE}Response:${NC}"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"

  # 응답 데이터 파싱
  status_2xx=$(echo "$body" | jq -r '.status_2xx' 2>/dev/null)
  status_4xx=$(echo "$body" | jq -r '.status_4xx' 2>/dev/null)
  status_5xx=$(echo "$body" | jq -r '.status_5xx' 2>/dev/null)
  request_per_min=$(echo "$body" | jq -r '.request_per_min' 2>/dev/null)
  p95_latency=$(echo "$body" | jq -r '.p95_latency' 2>/dev/null)

  echo ""
  echo -e "${BLUE}Summary Statistics:${NC}"
  echo -e "  2xx responses: ${GREEN}${status_2xx}${NC}"
  echo -e "  4xx responses: ${YELLOW}${status_4xx}${NC}"
  echo -e "  5xx responses: ${RED}${status_5xx}${NC}"
  echo -e "  Requests/min: ${GREEN}${request_per_min}${NC}"
  echo -e "  P95 Latency: ${GREEN}${p95_latency}ms${NC}"
else
  echo -e "${RED}✗ Request failed (HTTP ${http_code})${NC}"
  echo "$body"
fi

echo ""
echo -e "${BLUE}------------------------------------------------${NC}"
echo ""

# 4. GET /api/metrics/timeseries 테스트
echo -e "${YELLOW}[4/4] Testing GET /api/metrics/timeseries${NC}"

# 다양한 range/interval 조합 테스트
test_cases=(
  "12h:5m"
  "24h:1h"
  "6h:1m"
)

for test_case in "${test_cases[@]}"; do
  IFS=':' read -r range interval <<< "$test_case"

  echo ""
  echo -e "${BLUE}Test case: range=${range}, interval=${interval}${NC}"
  echo "Endpoint: ${API_BASE_URL}/timeseries?range=${range}&interval=${interval}"

  start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
  response=$(curl -s -w "\n%{http_code}\n%{time_total}" "${API_BASE_URL}/timeseries?range=${range}&interval=${interval}")
  end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')

  http_code=$(echo "$response" | tail -2 | head -1)
  time_total=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -2)

  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Request successful (HTTP ${http_code})${NC}"
    echo -e "  Response time: ${GREEN}${time_total}s${NC}"
    echo -e "  Total elapsed: ${GREEN}$((end_time - start_time))ms${NC}"

    # 데이터 포인트 개수 확인
    data_count=$(echo "$body" | jq '.data | length' 2>/dev/null)
    if [ -n "$data_count" ] && [ "$data_count" != "null" ]; then
      echo -e "  Data points returned: ${GREEN}${data_count}${NC}"

      # 첫 번째와 마지막 데이터 포인트 표시
      first_point=$(echo "$body" | jq '.data[0]' 2>/dev/null)
      last_point=$(echo "$body" | jq '.data[-1]' 2>/dev/null)

      echo ""
      echo -e "${BLUE}First data point:${NC}"
      echo "$first_point" | jq '.' 2>/dev/null
      echo ""
      echo -e "${BLUE}Last data point:${NC}"
      echo "$last_point" | jq '.' 2>/dev/null

      # 평균값 계산
      avg_requests=$(echo "$body" | jq '[.data[].requests] | add / length | floor' 2>/dev/null)
      avg_errors=$(echo "$body" | jq '[.data[].errors] | add / length | floor' 2>/dev/null)
      avg_cpu=$(echo "$body" | jq '[.data[].cpu] | add / length | floor' 2>/dev/null)
      avg_memory=$(echo "$body" | jq '[.data[].memory] | add / length | floor' 2>/dev/null)

      echo ""
      echo -e "${BLUE}Average values across all data points:${NC}"
      echo -e "  Avg requests: ${GREEN}${avg_requests}${NC}"
      echo -e "  Avg errors: ${YELLOW}${avg_errors}%${NC}"
      echo -e "  Avg CPU: ${GREEN}${avg_cpu}%${NC}"
      echo -e "  Avg Memory: ${GREEN}${avg_memory}GB${NC}"
    fi
  else
    echo -e "${RED}✗ Request failed (HTTP ${http_code})${NC}"
    echo "$body" | head -20
  fi

  echo -e "${BLUE}------------------------------------------------${NC}"
done

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  All tests completed!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# 성능 요약
echo -e "${BLUE}Performance Summary:${NC}"
echo -e "  • Data generation: Fast bulk insert with generate_series()"
echo -e "  • Query optimization: Using TimescaleDB time_bucket() for aggregation"
echo -e "  • Expected response time: < 500ms for most queries"
echo ""

# 클린업 옵션
echo -e "${YELLOW}Clean up test data?${NC}"
echo "Run: PGPASSWORD='${DB_PASS}' psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c \"DELETE FROM api_metrics WHERE service = 'test-service'; DELETE FROM system_metrics WHERE service = 'test-service';\""
echo ""
