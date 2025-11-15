# APM 프로젝트: 실시간 집계용 10초 버킷화 & Redis 캐시 설계 명세

이 문서는 기존 **APM Query-API**에 **Redis 기반 캐시 + 10초 시간 버킷(bucketing)**을 추가하여, 반복되는 실시간 집계 요청의 부하를 줄이기 위한 설계 명세다.  
현재 시스템에는 **Redis 캐시와 버킷화 로직이 전혀 구현되어 있지 않으며**, 모든 메트릭 조회는 Elasticsearch(이하 ES)에 대해 실시간 집계를 수행한다.

이 문서는 CLI codex 또는 개발자가 이 설계를 바탕으로 기존 코드를 수정/추가할 수 있도록 **구체적인 요구사항, 실패 시 동작, 모듈 구조, 키 설계, 알고리즘**까지 포함한다.

---

## 1. 현재 상태 및 목표

### 1.1 현재 상태 (전제)

- 서비스 구성
  - `stream-processor`  
    - Kafka에서 로그/스팬 토픽(예: `apm.logs`, `apm.spans`)을 실시간으로 consume  
    - ES 데이터 스트림(`logs-apm.*`, `traces-apm.*`)에 인덱싱
  - `query-api`  
    - NestJS 기반 HTTP API  
    - 브라우저/대시보드에서 들어오는 요청을 받아 ES에 **실시간 집계 쿼리**를 수행  
    - 현재는 **어떠한 캐시도 사용하지 않고**,  
      `from`/`to`/`interval` 등 요청 파라미터를 그대로 ES에 전달

- 메트릭 엔드포인트 (대표)
  - `GET /services/{serviceName}/metrics`
    - latency(p50/p90/p95), `request_total`, `error_rate` 등 집계
  - 이외에 서비스/엔드포인트 단위 메트릭을 제공하는 유사한 API들이 존재할 수 있음.

- 문제점
  - 대시보드에서 **짧은 주기(예: 5~15초)**로 동일/유사한 시간 범위(예: “최근 1시간”)를 반복 조회할 때마다 ES에서 동일한 집계를 다시 수행.
  - 사용자/탭 수가 늘어나면, 같은 구간에 대한 집계 쿼리가 ES에 중복으로 들어가 부하 증가.

### 1.2 개선 목표

1. **10초 버킷팅(bucketing)**  
   - “최근 1시간”과 같은 슬라이딩 윈도우 조회에 대해  
     **10초 단위로 시간 범위를 정규화**하여,  
     10초 동안 들어오는 동일 유형의 요청이 **동일한 from/to로 정규화**되도록 한다.
2. **짧은 TTL Redis 캐시**  
   - 정규화된 쿼리를 기준으로 **Redis 키-값 캐시를 도입**하여,  
     동일 쿼리에 대해 ES 집계를 반복 수행하는 대신 캐시 결과를 재사용한다.
   - TTL은 10초 버킷화 주기를 고려해 **약간 더 긴 값(예: 20~30초)**으로 설정한다.
3. **기존 기능과의 호환성 유지**
   - 캐시/버킷화 기능은 **점진적 최적화 레이어**로 동작해야 하며,  
     캐시가 동작하지 않더라도 기존과 동일한 결과를 제공해야 한다.
   - Redis 장애 시에도 **기능 저하(graceful degradation)**만 있을 뿐, API는 계속 정상 동작해야 한다.

---

## 2. 적용 범위 및 정책

### 2.1 적용 대상 API

우선 적용 대상은 다음 엔드포인트로 한정한다.

- `GET /services/{serviceName}/metrics`
  - 슬라이딩 윈도우로 “최근 5분/15분/1시간” 등을 조회하는 **대표 메트릭 API**.

이후 필요 시, 동일 패턴으로 확장 가능한 후보:

- `GET /services`
- `GET /services/{serviceName}/endpoints`

**본 명세에서는 1차 대상 엔드포인트로  
`/services/{serviceName}/metrics`만을 필수 구현 범위로 정의**한다.

### 2.2 캐싱 대상/비대상 쿼리 구분

캐시/버킷화 적용 여부는 쿼리 유형에 따라 달라진다.

1. **슬라이딩 윈도우 기본 조회 (캐싱/버킷화 대상)**  
   - 클라이언트가 `from`/`to`를 명시하지 않고,  
     예를 들어 다음과 같은 의미로 요청하는 경우:
     - “최근 1시간” (default)
     - “최근 N분/시간” 등 서버에서 기본 윈도우를 결정하는 경우
   - 이 경우:
     - 서버가 **현재 시각 기준 슬라이딩 윈도우**를 정의하고
     - **10초 버킷화를 적용**
     - 정규화된 쿼리에 대해 Redis 캐시를 사용

2. **사용자 지정 `from`/`to` 조회 (기본적으로 캐시 비대상)**  
   - 클라이언트가 과거 특정 시점 구간을 직접 지정하는 경우:
     - 예: `from=2025-11-14T00:00:00Z&to=2025-11-14T01:00:00Z`
   - 기본 정책:
     - 이 경우는 “ad-hoc 분석”으로 간주하고,  
       **캐시/버킷화의 이점이 작고 구현 복잡도가 증가하므로**  
       1차 구현에서는 **캐시를 사용하지 않는다.**
   - 필요 시 향후:
     - 요청 파라미터 전체를 포함한 캐시 키를 설계하여  
       사용자 지정 구간도 캐시 대상으로 확장 가능.

---

## 3. 10초 버킷화 설계

### 3.1 버킷화 개념

- 버킷 단위(bucketing unit) `Q` = **10초**
- 기본 슬라이딩 윈도우 길이 `W` = **예: 1시간 (3600초)**  
  - 실제 값은 기존 시스템 기본값으로 맞춘다 (예: 15분/1시간 중 하나).
- 현재 시각 `now` (ms 단위)를 다음과 같이 버킷화:

```text
quantizedNowMs = floor(nowMs / (Q * 1000)) * (Q * 1000)
to   = new Date(quantizedNowMs)
from = new Date(quantizedNowMs - W * 1000)
```

- 효과:
  - 10초 이내에 들어오는 모든 슬라이딩 윈도우 요청은  
    **동일한 from/to 구간을 사용**하게 되어 캐시 키도 동일해진다.

### 3.2 버킷화 적용 조건

- 다음 조건을 모두 만족할 때만 10초 버킷화를 적용한다.
  1. 클라이언트가 `from`/`to` 파라미터를 제공하지 않았다.
  2. 쿼리 타입이 “슬라이딩 윈도우 기본 조회”로 간주되는 경우.
  3. 서비스 환경이 “실시간 대시보드”로 명확한 경우 (별도 플래그 필요 시 확장).

- 반대로, 다음 경우에는 버킷화를 적용하지 않는다.
  - `from`/`to`가 명시된 ad-hoc 조회
  - 내부적으로 정확한 경계가 중요한 특수 분석 API (현재 범위 밖이므로 고려하지 않음)

### 3.3 정규화 결과 타입

정규화된 쿼리를 표현하는 공통 타입(의사 코드):

```ts
type NormalizedMetricsQuery = {
  serviceName: string;
  metric: 'latency' | 'request_total' | 'error_rate' | 'all';
  from: Date;       // 버킷화 또는 사용자 지정 결과 (항상 값 존재)
  to: Date;         // 버킷화 또는 사용자 지정 결과 (항상 값 존재)
  environment: string | null;
  interval: string; // 예: "10s", "30s", "1m" 등 실제 ES date_histogram interval
  isSlidingWindow: boolean; // 버킷화된 슬라이딩 윈도우인지 여부
};
```

- `isSlidingWindow = true`인 경우에만 캐시/버킷화 대상이며,  
  `from/to`는 **항상 10초 단위로 맞춰져 있게 된다.**

---

## 4. Redis 캐시 설계

### 4.1 캐시 계층 위치

- 캐시 로직은 **Query-API 서비스 계층**에 위치한다.
- 처리 순서:
  1. 컨트롤러에서 DTO를 통해 쿼리 파라미터 파싱
  2. **쿼리 정규화 서비스**가 `NormalizedMetricsQuery` 생성 (버킷화 포함)
  3. **MetricsService**가 다음 로직 수행:
     - 캐시 키 생성
     - Redis 조회 (hit 시 즉시 반환)
     - 미스 시 ES 집계 → 결과 Redis에 저장 → 응답 반환

- NestJS 구조 예 (파일명/클래스명은 예시):

  - `metrics.controller.ts`  
    - `GET /services/:serviceName/metrics`
  - `metrics.service.ts`  
    - `getServiceMetrics(serviceName, dto)`
  - `metrics-query-normalizer.service.ts`  
    - `normalizeServiceMetrics(serviceName, dto): NormalizedMetricsQuery`
  - `metrics-cache.service.ts`  
    - Redis 연동 및 캐시 get/set 추상화

### 4.2 캐시 키 설계

캐시 키는 **정규화된 쿼리의 의미가 동일하면 항상 동일**하게 생성되어야 한다.  
구성 요소는 다음과 같다.

필수 요소:

- `serviceName` – path 파라미터
- `environment` – 쿼리 파라미터 (없으면 `"all"`)
- `metric` – 단일 메트릭 또는 `"all"`
- `from` – 정규화된 시작 시각 (ISO 문자열, 초 단위까지)
- `to` – 정규화된 종료 시각 (ISO 문자열, 초 단위까지)
- `interval` – ES date_histogram interval (예: `"10s"`, `"30s"`, `"1m"`)

추가 요소 (있다면 반드시 포함):

- 필터링 필드 (예: `endpoint`, `http_status_class` 등)

키 포맷 예시 (문자열):

```text
apm:metrics:v1:
service:{serviceName}:
env:{environmentOrAll}:
metric:{metricOrAll}:
from:{fromIso}:
to:{toIso}:
interval:{interval}:
filters:{normalizedFilterString}
```

- 예시 키:

```text
apm:metrics:v1:
service:order-service:
env:prod:
metric:all:
from:2025-11-14T07:00:00Z:
to:2025-11-14T08:00:00Z:
interval:30s:
filters:endpoint=/api/orders,status=all
```

> **주의**:  
> - `from`/`to`는 반드시 **버킷화된 시각(10초 배수)**로 정규화된 값이어야 한다.  
> - `filters`는 항상 동일 순서/형태로 직렬화해야 한다. (예: key를 정렬한 후 `key=value` 조합을 `,`로 연결)

### 4.3 캐시 값(Value) 설계

- Value는 해당 API의 **최종 응답 JSON 전체**를 그대로 직렬화해서 저장한다.
  - 장점:
    - 응답 스키마 변경 시, 캐시 구조를 별도로 맞출 필요가 없음.
    - 복수 메트릭(p50/p90/p95/requests/error_rate)을 한 번에 캐싱 가능.
- 직렬화 형식:
  - JSON 문자열 그대로 저장 (Redis string)
  - 또는 캐시 라이브러리에서 제공하는 직렬화 기능 사용 (간단하게 string으로 가정한다).

예시:

```json
{
  "serviceName": "order-service",
  "environment": "prod",
  "window": {
    "from": "2025-11-14T07:00:00Z",
    "to": "2025-11-14T08:00:00Z",
    "interval": "30s"
  },
  "metrics": {
    "latency": {
      "p50": [...],
      "p90": [...],
      "p95": []
    },
    "request_total": [],
    "error_rate": []
  }
}
```

이 JSON 전체가 Redis value로 저장된다.

### 4.4 TTL 정책

- 버킷화 단위 `Q` = 10초를 고려할 때, TTL 설정 기준:
  - **최소**: 10초 (동일 구간 안에서만 재사용)
  - **권장**: 20~30초
- 권장값 예:
  - `TTL_SECONDS = 20`
- 이유:
  - 10초 구간 동안 들어온 요청이 같은 결과를 재사용하도록 하고,
  - 네트워크/스케줄링 지터로 인한 소폭 시각 차이를 흡수.
- TTL이 만료되면:
  - 다음 동일 쿼리에서 캐시 미스 → ES 집계 재실행 → 새 결과로 캐시 갱신.

### 4.5 Redis 장애 시 동작

- Redis에 연결 실패 / get 오류 / set 오류 발생 시:
  - **절대 요청을 실패시키지 않는다.**
  - 처리 전략:
    - 캐시 read:
      - 오류 발생 시 → 캐시 미스처럼 취급 → ES 집계 진행
    - 캐시 write:
      - 오류 발생 시 → 로그만 남기고 무시 (ES 결과는 그대로 반환)
- 모든 캐시 연산은 **“best effort”**로 동작해야 하며,  
  캐시 없이도 시스템은 원래처럼 동작해야 한다.

---

## 5. NestJS 레벨 구조/로직

### 5.1 모듈/서비스 구조

**필수 신규/수정 요소:**

1. **Redis 클라이언트/캐시 모듈**
   - 예) `RedisModule` / `CacheModule` (구현 방식은 프로젝트 컨벤션에 맞춘다)
   - 환경변수:
     - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` 등

2. **MetricsQueryNormalizerService**
   - 책임:
     - `ServiceMetricsQueryDto` → `NormalizedMetricsQuery` 변환
     - 10초 버킷화 로직 적용
     - `interval` 자동 설정 (예: window 길이에 따라 10s/30s/1m 결정)

3. **MetricsCacheService**
   - 책임:
     - `buildKey(normalized: NormalizedMetricsQuery): string`
     - `get(key: string): Promise<string | null>`
     - `set(key: string, value: string, ttlSeconds: number): Promise<void>`

4. **MetricsService**
   - 책임:
     - 정규화된 쿼리 기반으로 캐시를 조회하고,  
       캐시 미스 시 ES에 실시간 집계 쿼리를 수행한 뒤 캐시에 저장.

### 5.2 요청 처리 흐름 (의사 코드)

컨트롤러:

```ts
@Get('/services/:serviceName/metrics')
async getServiceMetrics(
  @Param('serviceName') serviceName: string,
  @Query() queryDto: ServiceMetricsQueryDto,
): Promise<MetricsResponseDto> {
  return this.metricsService.getServiceMetrics(serviceName, queryDto);
}
```

서비스:

```ts
async getServiceMetrics(serviceName: string, queryDto: ServiceMetricsQueryDto) {
  // 1) 쿼리 정규화 (10초 버킷화 포함)
  const normalized = this.metricsQueryNormalizer.normalizeServiceMetrics(serviceName, queryDto);

  // 2) 캐시 사용 여부 판단
  const shouldUseCache = normalized.isSlidingWindow; // 1차 구현 기준

  let cacheKey: string | null = null;
  if (shouldUseCache) {
    cacheKey = this.metricsCache.buildKey(normalized);
    const cached = await this.metricsCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // 3) ES 집계 수행 (기존 로직 그대로 재사용)
  const esResult = await this.metricsEsRepository.queryServiceMetrics(normalized);

  // 4) 캐시에 저장 (best-effort)
  if (shouldUseCache && cacheKey) {
    try {
      await this.metricsCache.set(cacheKey, JSON.stringify(esResult), 20 /* TTL seconds */);
    } catch (e) {
      // 로그만 남기고 무시
    }
  }

  return esResult;
}
```

---

## 6. MetricsQueryNormalizer 세부 설계

### 6.1 입력 DTO 예시 (이미 존재한다고 가정)

```ts
class ServiceMetricsQueryDto {
  metric?: string;        // 'latency', 'request_total', 'error_rate', 'all'
  from?: string;          // ISO 8601
  to?: string;            // ISO 8601
  environment?: string;   // 'prod', 'dev' 등
  interval?: string;      // 옵셔널, '10s', '30s', '1m' 등
  // 기타 필터 필드 (endpoint, status 등)
}
```

### 6.2 정규화 로직

#### 6.2.1 metric, environment 정규화

- `metric`
  - 값이 없으면 `'all'`
  - 허용 값 외 입력 시 400 또는 기본값 `'all'`로 치환 (정책에 따라 선택)
- `environment`
  - 값이 없으면 `null`로 저장 (캐시 키에서는 `"all"`로 표현)

#### 6.2.2 from/to, isSlidingWindow 결정

1. `from`과 `to` 모두 제공된 경우:
   - `isSlidingWindow = false`
   - `from = new Date(dto.from)`
   - `to   = new Date(dto.to)`
   - **버킷화 적용 안 함**

2. 둘 다 제공되지 않은 경우:
   - `isSlidingWindow = true`
   - `now = Date.now()`
   - `quantizedNow = floor(now / (10s)) * 10s`
   - `to   = new Date(quantizedNow)`
   - `from = new Date(quantizedNow - DEFAULT_WINDOW_MS)`  
     - `DEFAULT_WINDOW_MS`는 기존 시스템 정책(예: 1시간 = 3600000) 사용

3. 한쪽만 있는 경우:
   - 1차 구현에서는 **요청을 400으로 처리**하거나,  
     내부 정책으로 보정 (예: `from`만 있을 때 `to=now`) 중 하나를 선택해야 한다.
   - 단순화를 위해:  
     - **버킷화/캐싱 대상에서 제외**하고 그대로 ES 실시간 집계만 수행하는 것도 가능.  
       (이 케이스는 자주 쓰이지 않는다고 가정)

#### 6.2.3 interval 자동 결정

- `interval`이 명시되지 않은 경우:
  - `(to - from)` 길이에 따라 자동 결정:
    - 0~30분: `"10s"` 또는 `"30s"`
    - 30분~2시간: `"30s"` 또는 `"1m"`
    - 2시간 이상: `"1m"` 또는 `"5m"`
- 정해진 interval 값은 반드시 `NormalizedMetricsQuery.interval`에 저장되어  
  캐시 키 생성과 ES `date_histogram` 설정에 사용된다.

---

## 7. 테스트 전략

### 7.1 기능 테스트 케이스

1. **슬라이딩 윈도우 기본 조회 – 캐시 미스 → 히트**
   - 시나리오:
     1. `from/to` 없이 `/services/order-service/metrics` 호출 (현재 시각 기준)
     2. ES 집계 수행, Redis에 값 저장
     3. 10초 이내에 동일 요청 반복
     4. 두 번째 요청은 ES에 쿼리 없이 Redis 캐시에서 응답
   - 검증:
     - 두 응답 내용이 동일해야 함.
     - 두 번째 요청에서 ES 쿼리가 발생하지 않아야 함(가능하면 모킹/메트릭으로 검증).

2. **버킷화 동작 검증**
   - 시각 차이가 약간 다른 요청(예: 2초/7초 차이)이라도  
     `from/to`가 동일한 값으로 정규화되는지 확인.
   - 예: 17:00:01, 17:00:09에 호출 → 둘 다 `to=17:00:00`, `from=16:00:00`.

3. **TTL 만료 후 재집계**
   - 캐시 TTL을 테스트용으로 짧게 설정(예: 3초).
   - 요청 → 캐시 miss → 저장 → 2초 후 재요청 → hit → 4초 후 재요청 → miss → 재집계.

4. **사용자 지정 from/to – 캐시 사용 안 함**
   - `from`, `to`를 명시한 요청에서:
     - `isSlidingWindow=false`, 캐시 미사용.
   - 동일 요청 두 번 호출 시, ES 쿼리가 매번 실행되는지 확인.

5. **Redis 장애 시 fallback**
   - Redis 클라이언트 mock을 이용해 `get`/`set` 호출에서 예외 발생시키기.
   - API는 정상 응답을 반환해야 하고,
   - 에러 로그만 남는지 확인.

### 7.2 경계 조건 테스트

- **버킷화 경계 시각**
  - 정확히 10초 배수 시각(예: `...:00`, `...:10`)에서 요청이 들어왔을 때  
    `to`가 해당 시각으로 설정되는지 확인.
- **대상 외 파라미터**
  - 잘못된 `metric`, `interval` 값 입력 시 처리 정책 검증.
- **캐시 키 일관성**
  - 필터 순서가 다른 두 요청(예: `status=500&endpoint=/a` vs `endpoint=/a&status=500`)  
    에 대해 캐시 키가 동일하게 생성되는지 검증.

---

## 8. 구현 체크리스트 (Codex용 요약)

다음 단계는 CLI codex 또는 개발자가 실제 코드 변경 시 참고할 수 있는 **구현 단계 체크리스트**다.

1. **Redis 의존성 추가**
   - NestJS 프로젝트에 Redis 클라이언트/캐시 모듈 추가
   - 환경변수 및 설정 모듈에 `REDIS_*` 값 반영

2. **`MetricsQueryNormalizerService` 생성**
   - 입력 DTO(`ServiceMetricsQueryDto`) → `NormalizedMetricsQuery` 변환
   - 10초 버킷화 로직 구현 (`isSlidingWindow=true` 케이스)
   - `interval` 자동 결정 로직 구현

3. **`MetricsCacheService` 생성**
   - `buildKey(normalized)` 구현
   - `get(key)`/`set(key, value, ttl)` 구현
   - Redis 오류 시 예외 전파하지 않고 무시하도록 처리

4. **`MetricsService` 수정**
   - `getServiceMetrics()` 내부에서:
     - Normalizer 호출
     - 캐시 키 생성 및 조회
     - 캐시 미스 시 기존 ES 집계 로직 호출
     - 결과 캐시에 저장 후 반환
   - `isSlidingWindow=false`인 경우 캐시/버킷화 미적용

5. **테스트 코드 추가**
   - 위 7장에 정의된 주요 시나리오에 대한 단위/통합 테스트 작성
   - 최소:
     - 캐시 히트/미스
     - 버킷화 적용 여부
     - Redis 장애 fallback

---

이 문서는 **현재 “실시간 ES 집계만 있는 상태”**를 기준으로,  
**추가로 “10초 버킷화 + 짧은 TTL Redis 캐시”를 도입하기 위한 설계**만을 다룬다.

롤업 인덱스(1분 버킷) 도입은 별도의 `rollup_metrics_spec.md`에서 정의한 대로 독립적으로 진행할 수 있으며,  
최종적으로는:

- 짧은 구간(예: 최근 5~15분): **raw 집계 + 이 명세의 캐시/버킷화**
- 긴 구간(예: 1시간 이상): **롤업 인덱스 기반 조회 + 별도 캐시**

로 조합해서 사용하면 된다.
