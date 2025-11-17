# APM 프로젝트: 롤업 인덱스와 실시간 집계 설계 명세

이 문서는 기존 **APM 프로젝트**에서 제공하는 실시간 집계 기능을 확장하여, **롤업(Roll‑up) 인덱스**를 도입하고 **짧은 구간은 원본(raw) 집계 + 캐시**로 처리하는 하이브리드 방식을 구현하기 위한 상세 명세입니다. 이 명세는 CLI codex나 개발자가 읽고 그대로 구현할 수 있을 정도로 구체적으로 작성되었습니다. 문서의 모든 시간은 **Asia/Seoul** 기준이며, 현재 날짜는 2025‑11‑14입니다.

## 1. 배경 및 목표

현재 APM 시스템은 다음과 같이 동작합니다:

- **데이터 수집 파이프라인**: 애플리케이션에서 생성되는 로그/스팬을 Kafka 토픽(`apm.logs`, `apm.spans`)에 발행하고, `stream‑processor` 서비스가 이를 소비하여 Elasticsearch 데이터 스트림(`logs-apm.*`, `traces-apm.*`)에 인덱싱합니다. 이때 stream-processor는 `apm_bulk_design.md`에 정의된 BulkIndexer로 문서를 버퍼링한 뒤 `_bulk` API로 저장하며, 이 단계에서는 어떤 롤업/집계도 수행하지 않습니다.
- **조회 API(Query‑API)**: NestJS 기반 서비스로, Elasticsearch에서 시간 범위에 맞는 로그/스팬을 조회하면서 집계(`percentiles`, `sum`, `filter` 등)를 수행하여 메트릭(p50, p90, p95, request_total, error_rate)을 실시간으로 계산하고 응답합니다.

**문제점**: 장기 구간(예: 최근 1시간 이상)을 지속적으로 조회할 경우, 매번 원본 로그/스팬 전체를 스캔해야 하므로 Elasticsearch 및 `stream‑processor`의 부하가 증가합니다. 또한 SLA/SLO 보고서나 주간/월간 대시보드와 같이 장기 데이터를 자주 조회하는 경우 성능과 비용 문제가 발생합니다.

**목표**: 다음과 같은 하이브리드 방식을 구현합니다.

1. **롤업(Roll‑up) 인덱스 도입**: 로그/스팬 원본을 일정한 시간 단위(이 문서에서는 1분 버킷으로 정의)로 미리 집계하여 별도의 인덱스에 저장합니다. 이 인덱스는 p50/p90/p95, 요청 수, 오류 수 등을 포함한 요약 메트릭을 제공합니다.
2. **짧은 구간은 원본 집계 + 캐시 유지**: 최근 몇 분(예: 5분 이내)은 여전히 원본 인덱스에서 실시간 집계하여 최신 데이터를 제공합니다. 해당 부분은 Redis 캐시(10초 시간 버킷) 전략을 사용합니다.
3. **Query‑API 개선**: 요청 범위에 따라 raw 인덱스, 롤업 인덱스 또는 두 데이터를 결합하여 응답을 생성합니다. 이 과정은 완전히 자동화되어야 하며, 기존 엔드포인트와 스키마를 유지합니다.
4. **롤업/집계 파이프라인 분리**: ingest 단계(Bulk 색인)에서는 오로지 문서 저장에만 집중하고, 1분 버킷 카운트 같은 집계는 Elasticsearch Transform·Aggregation API·Cron job 등 별도 후처리 경로로 구현합니다. 컨슈머에서 집계까지 수행하면 per-message 처리 시간이 길어져 throughput이 크게 떨어지므로, 본 스펙의 모든 롤업/통계 계산은 **색인 후 비동기 파이프라인**에서 이루어져야 합니다.

## 2. 롤업 인덱스 설계

### 2.1 버킷 크기 선택

- 기본 버킷 크기를 **1분**으로 정의합니다. 1분은 짧은 간격의 실시간 분석과 비교적 긴 기간 조회(24시간, 7일 등) 사이의 균형을 고려한 값입니다.
- 필요에 따라 추가 해상도(10초, 5분, 1시간) 버킷을 도입할 수 있지만, 이 명세에서는 1분 버킷만을 정의합니다.

### 2.2 인덱스 네이밍 규칙

- **데이터 스트림/인덱스 패턴**: `metrics-apm.<서비스이름>-<namespace>`
  - 예시: `metrics-apm.order-service-prod`, `metrics-apm.user-service-dev`
- 각 데이터 스트림에는 1분 단위의 데이터가 저장됩니다. Kibana 등에서 이를 데이터 스트림으로 관리하면 rollover 및 ILM 정책 적용이 용이합니다.

### 2.3 매핑과 필드 정의

롤업 문서의 필드는 다음과 같습니다.

- `@timestamp_bucket` (`date`) – 집계된 버킷의 시작 시각(UTC). 예: `2025-11-14T08:05:00Z` (집계 대상은 08:05:00~08:05:59.999 사이의 이벤트)
- `service_name` (`keyword`) – 메트릭이 속한 서비스 이름
- `environment` (`keyword`) – 실행 환경 (예: `prod`, `stage` 등)
- `request_count` (`long`) – 해당 버킷 내 전체 요청/스팬 수(분모)
- `error_count` (`long`) – 오류로 분류된 요청/스팬 수(분자)
- `latency_p50_ms` (`double`) – 지연 시간 50번째 퍼센타일(밀리초)
- `latency_p90_ms` (`double`) – 지연 시간 90번째 퍼센타일(밀리초)
- `latency_p95_ms` (`double`) – 지연 시간 95번째 퍼센타일(밀리초)
- `latency_p99_ms` (`double`, 옵션) – 지연 시간 99번째 퍼센타일 (선택 사항)
- `error_rate` (`double`) – `error_count / request_count` 값 (실제 요청 시 계산해도 되지만 저장 시 계산하여 정확도를 높이는 것이 좋음)
- `target` (`keyword`, 옵션) – 서비스 내 특정 endpoint 등 추가 식별자에 사용 가능

매핑 예시는 다음과 같습니다(ES 템플릿으로 등록하는 형태):

```json
{
  "index_patterns": ["metrics-apm.*"],
  "data_stream": {},
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "@timestamp_bucket": { "type": "date" },
      "service_name": { "type": "keyword" },
      "environment": { "type": "keyword" },
      "request_count": { "type": "long" },
      "error_count": { "type": "long" },
      "latency_p50_ms": { "type": "double" },
      "latency_p90_ms": { "type": "double" },
      "latency_p95_ms": { "type": "double" },
      "latency_p99_ms": { "type": "double" },
      "error_rate": { "type": "double" },
      "target": { "type": "keyword" }
    }
  }
}
```

### 2.4 ILM(인덱스 수명 관리) 정책

- **보존 기간**: 메트릭 롤업 데이터는 로그보다 긴 기간이 요구될 수 있습니다. 기본 값으로 30일을 추천하며, 필요시 환경 변수로 조정합니다.
- **Rollover 조건**: 데이터 스트림을 사용하는 경우 ES가 자동으로 관리합니다. 단일 인덱스를 사용하는 경우 롤오버 정책을 구성해야 합니다(예: 일 단위 혹은 인덱스 크기 기준).

## 3. 롤업 데이터 생성 방법

### 3.1 Stream‑Processor 변경

현재 `stream‑processor`는 Kafka `apm.logs`/`apm.spans`를 BulkIndexer를 통해 raw 데이터 스트림에 저장합니다. 롤업 생산은 ingest 경로가 아닌 **별도 후처리 파이프라인**으로 구현합니다. 접근 방식은 다음 중 하나를 택합니다.

1. **Elasticsearch Transform**:
   - `logs-apm.*`와 `traces-apm.*`를 원천 인덱스로 지정하고 1분 버킷 Transform을 생성합니다.
   - Transform은 elasticsearch가 관리하므로 stream‑processor의 CPU/메모리를 소모하지 않고 롤업 인덱스(`metrics-apm.*`)를 채웁니다.
   - 퍼센타일 계산은 ES `percentiles` 집계를 사용합니다.
2. **별도 Aggregator(Worker)**:
   - Query-API 혹은 전용 워커 프로세스가 일정 주기(예: 30초)에 raw 인덱스를 집계하여 롤업 문서를 생성한 뒤 Bulk로 색인합니다.
   - 이 워커는 stream‑processor와 별도의 애플리케이션으로 운영되어 ingest 경로와 자원을 공유하지 않습니다.
3. **Redis/메시지 기반 파이프라인**:
   - 임시 저장소에 엔드포인트별 카운터를 적재 후, 일정 주기에 롤업 인덱스로 밀어 넣는 구조도 가능합니다. 핵심은 ingest 서비스와 집계 로직을 명확히 분리하는 것입니다.

선택한 방식과 관계없이 롤업 파이프라인은 실패해도 raw 색인을 막지 않아야 하며, stream‑processor의 BulkIndexer 처리량에 영향을 주지 않도록 독립적으로 운영해야 합니다.

### 3.2 ES Transform 사용 (대체안)

Elasticsearch 자체 기능인 Transform을 활용하는 방법도 있습니다. 이 경우:

1. `logs-apm.*`와 `traces-apm.*` 데이터 스트림을 대상으로 Transform을 생성하여 1분 단위 롤업을 수행합니다.
2. 대상 인덱스를 `metrics-apm`과 동일한 매핑으로 지정합니다.
3. Transform job은 지속형(continuous)으로 동작하게 설정하여 새 데이터가 들어올 때마다 롤업 레코드를 생성합니다.
4. Transform의 집계 파이프라인은 Elasticsearch가 관리하기 때문에, 서비스 코드 수정 없이 롤업 구현이 가능합니다. 단, Transform의 퍼센타일 계산에서는 ES 기본 `percentiles` 집계를 사용합니다.

Transform 방식은 인프라 차원에서 설정하면 되지만, 이번 명세에서는 애플리케이션 레벨에서 구현하는 방안을 기본으로 설명합니다.

## 4. Query‑API 개선

### 4.1 쿼리 범위 분기 기준

`Query‑API`에서 메트릭 조회 요청을 받을 때 다음 로직을 적용합니다.

1. **쿼리 파라미터 파싱**: `metric`(p50/p90/p95/requests_total/error_rate), `from`, `to`, `environment`, `interval`을 DTO로 파싱합니다. `from/to`가 없으면 기본값은 “현재 시각 기준 최근 15분”으로 설정합니다.
2. **시간 범위 계산**: `duration = to - from`을 계산합니다.
3. **분기 조건**: `duration`이 **사용자 지정 임계값**보다 짧으면 raw 집계, 길면 롤업 인덱스를 사용합니다.
   - 예시 임계값: `ROLLUP_THRESHOLD_MINUTES = 5`. 즉, 최근 5분 이내는 raw 조회, 그 이상은 롤업 사용.
4. **부분 범위 병합**: 쿼리 범위가 임계값을 넘을 경우, `to - threshold` 이전 부분은 롤업 인덱스에서, 마지막 임계 구간은 raw 인덱스에서 조회하여 결과를 합칩니다.

### 4.2 메트릭 계산 로직 변경

#### 4.2.1 Raw 집계 (기존 방식 유지)

기존 로직을 그대로 유지하되, 아래를 유의합니다:

- 시간 버킷화: `to`를 10초 단위로 내림하여 캐싱 키를 통일합니다.
- 필터 및 집계 DSL은 v2 스펙과 동일하게 작성합니다.
- 응답 스키마도 기존 `MetricResponse`를 유지합니다.
- 캐시 TTL은 10~20초로 유지합니다.

#### 4.2.2 롤업 집계

롤업을 사용하는 경우에는 다음과 같이 진행합니다.

1. **쿼리 작성**
   - 타임 필드는 `@timestamp_bucket`을 사용합니다.
   - 집계 시 `date_histogram` interval을 사용하지 않고, 롤업 레코드 자체가 이미 1분 버킷이므로 단순히 `range` 필터와 정렬만 필요합니다.
   - 예를 들어, 2025‑11‑14T08:00:00Z~08:59:59Z 구간의 `latency_p95_ms`를 조회하면 다음과 같은 DSL을 사용합니다.

   ```json
   {
     "query": {
       "bool": {
         "filter": [
           { "term": { "service_name": "order-service" } },
           { "term": { "environment": "prod" } },
           { "range": { "@timestamp_bucket": { "gte": "2025-11-14T08:00:00Z", "lt": "2025-11-14T09:00:00Z" } } }
         ]
       }
     },
     "sort": [ { "@timestamp_bucket": "asc" } ],
     "size": 1000
   }
   ```

2. **결과 가공**
   - ES에서 반환된 문서 리스트를 시간순으로 정렬하여 시계열 데이터로 변환합니다.
   - 요청된 metric 종류(`metric` 파라미터)에 따라 `latency_p95_ms`, `latency_p50_ms`, `request_count`, `error_rate` 등 필요한 필드를 추출합니다.
3. **캐싱 전략**
   - 롤업 데이터는 기본적으로 이미 요약된 데이터여서 raw 조회보다 부하가 작습니다. 하지만 동일 범위의 요청이 반복될 수 있으므로 캐싱을 적용합니다.
   - 캐시 키: `metrics-rollup:{service}:{env}:{metric}:{from}:{to}`
   - TTL: `30s`~`60s` 정도로 설정하여 최근 쿼리에 대한 재사용성을 높입니다.

#### 4.2.3 혼합 구간 처리

예를 들어, `from=2025-11-14T08:00:00Z`, `to=2025-11-14T08:06:00Z` (6분)인 요청에서 임계값이 5분이라면:

1. `splitPoint = to - threshold = 2025-11-14T08:01:00Z`
2. **롤업 부분**: [08:00:00Z ~ 08:01:00Z) → 롤업 인덱스에서 1분 버킷 1개 조회
3. **raw 부분**: [08:01:00Z ~ 08:06:00Z) → raw 인덱스에서 기존 집계 DSL 사용
4. 두 결과를 시간순으로 합쳐 응답합니다.

### 4.3 코드 구조 변경 제안 (NestJS)

1. **RollupMetricsRepository** (`metrics-apm` 전용)
   - 인덱스 이름, 환경 등을 받아 롤업 쿼리를 수행하는 서비스.
   - `queryRollupMetrics(normalizedQuery: NormalizedServiceMetricsQuery): Promise<MetricsResponse>` 메서드 제공.
2. **RawMetricsRepository** (기존 코드)
   - 기존 `SpansRepository`/`LogsRepository`에 있는 집계 기능을 모듈화하여 메트릭 전용으로 추출.
3. **ServiceMetricsService** (조정 필요)
   - `normalizeServiceMetrics()`에서 범위 길이를 체크하여 raw/rollup/혼합을 결정합니다.
   - 캐시 키를 raw와 rollup 쿼리에 대해 구분하여 생성합니다.
4. **환경 변수 추가**
   - `ROLLUP_ENABLED` (기본 `true`)
   - `ROLLUP_THRESHOLD_MINUTES` (기본 `5`)
   - `ROLLUP_INDEX_PREFIX` (기본 `metrics-apm`)
   - `ROLLUP_BUCKET_MINUTES` (기본 `1`)
   - `ROLLUP_CACHE_TTL_SECONDS` (기본 `60`)

이 구조를 통해 Query‑API는 기존 엔드포인트와 호환성을 유지하면서도 롤업 기반 조회를 도입할 수 있습니다.

## 5. 배포 및 운영 지침

1. **롤업 인덱스 템플릿/ILM 적용**: 앞서 제시한 매핑과 보존 정책을 Elasticsearch 클러스터에 등록합니다. 수집 환경별(namespace별)로 템플릿 이름을 구분합니다.
2. **stream‑processor 업데이트 배포**: 롤업 집계 모듈을 통합한 후, Canary 배포 등으로 점진적으로 도입합니다. 배포 전에 Kafka lag과 ES 인덱싱 지연을 모니터링하여, 롤업 연산이 **별도의 후처리 파이프라인에서 동작하고 ingest 경로를 방해하지 않는지** 확인합니다.
3. **모니터링**: 롤업 인덱스 생성률, 문서 수, 집계 지연 등을 대시보드로 구성하여 이상을 감지합니다. raw 인덱스와 롤업 인덱스의 데이터가 동일 기간에 대해 일치하는지도 확인합니다.
4. **백필(backfill)**: 롤업 도입 이전 기간에 대해 과거 데이터를 롤업 인덱스에 채워 넣어야 하는 경우, 별도의 배치 프로세스를 만들어 일정 구간씩 raw 데이터를 읽어 롤업 문서를 생성합니다. 백필 작업은 스로틀링(throttling)을 걸어서 클러스터 부하를 피하도록 합니다.

## 6. 테스트 및 검증 시나리오

1. **기본 동작 테스트**
   - 새로 생성된 롤업 인덱스에 1분 단위 문서가 적절히 작성되는지 확인합니다.
   - Query‑API에서 `from/to`를 임계값보다 짧은 범위로 지정할 때 raw 집계 결과가 반환되는지 검증합니다.
   - `from/to`가 긴 범위일 때 롤업 데이터만 사용되는지, 혼합 범위에서 결과가 올바르게 합쳐지는지 확인합니다.
2. **성능 테스트**
   - 기존 구조 대비 롤업 도입 후 장기 구간(예: 1시간, 24시간) 조회의 응답 시간이 얼마나 줄어드는지 측정합니다.
   - Redis 캐시가 히트할 때/미스할 때의 응답 속도 차이를 분석합니다.
3. **에지 케이스**
   - 데이터가 아예 없는 구간(과거 or 미래)에 대한 조회
   - 동일한 `@timestamp_bucket` 값이 여러 서비스에 존재할 때 결과 필터링
   - 임계값이 매우 작거나 큰 값으로 설정될 때 동작

## 7. 향후 확장 가능성

- **다중 버킷 크기**: 10초, 1분, 5분 등 다양한 해상도의 롤업을 동시에 저장하면 UX에 맞춰 더 세밀한 그래프를 그릴 수 있습니다.
- **메트릭 종류 확장**: 데이터베이스 쿼리 시간, 외부 호출 실패율 등 다른 메트릭도 롤업에 포함할 수 있습니다. 필드 추가 시 매핑을 확장하고 stream‑processor의 집계 로직을 수정해야 합니다.
- **다른 지표의 스트리밍**: 에러 로그 스트리밍(WebSocket + Kafka)을 롤업과 연계하여, 에러가 급증할 때 롤업 지표를 기반으로 알람 트리거 등으로 활용할 수 있습니다.

## 8. 결론

이 명세는 APM 프로젝트에 롤업 인덱스를 도입하여 장기 구간 조회 성능을 개선하는 동시에, 최근 구간에 대해서는 기존과 동일한 실시간 집계와 캐시 전략을 유지하기 위한 구현 지침을 제공합니다. 문서에서 정의한 데이터 구조, 인덱스 매핑, stream‑processor 변경, Query‑API 수정 사항을 따르면, 기존 실시간 집계에 의존하던 아키텍처를 확장하여 데이터 조회 효율과 운영 안정성을 크게 향상시킬 수 있습니다.
