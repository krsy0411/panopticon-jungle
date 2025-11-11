# APM 데이터 수집 및 API 설계를 위한 구체적인 스펙

이 문서는 **APM MVP** 개발을 위해 *필수 데이터*만 추려서 수집하고, Elasticsearch 인덱싱 및 백엔드 API 구조를 구체적으로 정의한 것이다. 기존 APM 지침에서 설명한 전체 스펙을 참고하되, 이번 프로젝트에서는 **Logs**와 **Spans**만 수집하고, **Metrics**는 Elasticsearch 집계에서 파생한다.  

## 1 수집 데이터 예시(Logs / Spans)

### 1.1 로그(Log) 이벤트

로그는 특정 시점에 발생한 이벤트를 기록한다. MVP에서는 디버깅과 상태 추적에 필요한 핵심 필드만 남기고, 불필요한 세부 속성은 제거한다.

**필수 필드**

- `timestamp` – 이벤트 발생 시각(ISO‑8601).  
- `service_name` – 로그를 발생시킨 서비스 이름. Elastic의 공식 문서에 따르면 서비스 이름은 불변의 고유값이며 `keyword` 타입으로 저장한다【629151000030751†L150-L170】.  
- `environment` – 실행 환경(`prod`, `stage`, `dev` 등). 역시 `keyword` 타입이다【629151000030751†L150-L170】.  
- `level` – 로그 레벨(`DEBUG|INFO|WARN|ERROR`).  
- `message` – 사람이 읽을 수 있는 메시지.  
- `trace_id`(선택) – 이 로그가 속한 트레이스 식별자. APM 문서에서 `trace.id`는 `keyword` 타입으로 정의된다【629151000030751†L228-L233】.  
- `span_id`(선택) – 관련 스팬 식별자.
- `labels`(선택) – 낮은 카디널리티의 추가 태그. Elastic APM 참조에 따르면 `labels`는 문자열/숫자/불리언 값의 평면 맵이며 전체 객체로 저장한다【629151000030751†L144-L148】.

**예시 1 – 일반 로그**

```json
{
  "type": "log",
  "timestamp": "2025-11-10T12:00:12.123Z",
  "service_name": "order-service",
  "environment": "prod",
  "level": "INFO",
  "message": "Created order successfully",
  "trace_id": "8e3b9f5bcf214ea7",
  "span_id": "a1b2c3d4e5f6g7h8"
}
```

**예시 2 – HTTP 오류 로그**

```json
{
  "type": "log",
  "timestamp": "2025-11-10T12:02:01.500Z",
  "service_name": "payment-service",
  "environment": "prod",
  "level": "ERROR",
  "message": "Payment declined by card issuer",
  "trace_id": "c3d4e5f6a1b2c3d4",
  "span_id": "abcd1234efef5678",
  "http_method": "POST",
  "http_path": "/pay",
  "http_status_code": 502,
  "labels": {
    "error_code": "CARD_DECLINED"
  }
}
```

### 1.2 스팬(Span) 이벤트

스팬은 요청·트랜잭션을 구성하는 **시간 구간**이다. 하나의 `trace_id` 아래 여러 스팬이 트리 구조로 구성된다. Elastic APM 문서에 따르면 `trace.id`와 `parent.id`(부모 스팬 ID)는 `keyword` 타입【629151000030751†L228-L238】이며, `service.name` / `service.environment`도 `keyword`이다【629151000030751†L150-L170】. 프로젝트에서는 요청 지연 시간 분석을 위해 `duration_ms`(밀리초)와 상태(`OK` 또는 `ERROR`)만 저장한다.

**필수 필드**

- `timestamp` – 스팬 시작 시각.  
- `service_name`, `environment` – 위와 동일.  
- `trace_id` – 트레이스 ID【629151000030751†L228-L233】.  
- `span_id` – 스팬 ID.  
- `parent_span_id` – 부모 스팬 ID(루트 스팬은 `null`).  
- `name` – 작업 이름(예: `POST /orders`).  
- `kind` – 스팬 종류: `SERVER`(외부 요청 처리), `CLIENT`(외부 호출), `INTERNAL`(내부 연산).  
- `duration_ms` – 수행 시간(밀리초).  
- `status` – `OK` 또는 `ERROR`.  
- `labels`(선택) – 낮은 카디널리티의 부가 태그.

HTTP 요청·응답과 관련된 스팬에는 최소한 `http_method` / `http_path` / `http_status_code`를 포함한다. 데이터베이스 쿼리나 외부 API 호출일 때는 필요한 태그(`db.system`, `db.name` 등)만 `labels`에 넣고, 전체 쿼리문이나 연결 문자열처럼 카디널리티가 높은 정보는 저장하지 않는다.

**예시 3 – HTTP 서버 스팬**

```json
{
  "type": "span",
  "timestamp": "2025-11-10T12:00:12.100Z",
  "service_name": "order-service",
  "environment": "prod",
  "trace_id": "8e3b9f5bcf214ea7",
  "span_id": "a1b2c3d4e5f6g7h8",
  "parent_span_id": null,
  "name": "POST /orders",
  "kind": "SERVER",
  "duration_ms": 45.3,
  "status": "OK",
  "http_method": "POST",
  "http_path": "/orders",
  "http_status_code": 201
}
```

**예시 4 – DB 호출 스팬(Client)**

```json
{
  "type": "span",
  "timestamp": "2025-11-10T12:00:12.150Z",
  "service_name": "order-service",
  "environment": "prod",
  "trace_id": "8e3b9f5bcf214ea7",
  "span_id": "db1ef2345a6b7c8d",
  "parent_span_id": "a1b2c3d4e5f6g7h8",
  "name": "SELECT orders",
  "kind": "CLIENT",
  "duration_ms": 5.8,
  "status": "OK",
  "labels": {
    "db.system": "postgresql",
    "db.name": "panopticon"
  }
}
```

스팬에 포함될 태그는 **카디널리티가 낮은 정보만** 선택한다. 예를 들어 `db.statement`나 `db.connection_string`처럼 값이 길고 매번 다른 정보는 저장하지 않는다. 필요 시 별도 필드(`db_statement`)로 저장하되 `index: false`로 지정하여 검색을 비활성화한다.

## 2 Elasticsearch 인덱싱 템플릿 구조

MVP에서는 로그와 스팬을 각각 **데이터 스트림**에 저장한다. Elastic 문서에서는 시간 기반 데이터에 데이터 스트림을 사용하면 롤오버·ILM 관리가 쉬워지고 필드 수가 줄어드는 장점이 있다고 설명한다【897321232077862†L819-L827】. 데이터 스트림 이름은 `<type>-<dataset>-<namespace>` 패턴을 따르며【897321232077862†L831-L840】, 여기서는 `type=logs` 또는 `traces`, `dataset=apm.<서비스이름>` , `namespace=prod|stage|dev` 구조를 사용한다. 예시: `logs-apm.order-service-prod`, `traces-apm-prod`.

### 2.1 로그 템플릿

아래 템플릿은 `logs-apm.*` 데이터 스트림에 적용된다. 공통 필드는 Elastic APM 스펙에 따라 `keyword`로 매핑된다【629151000030751†L150-L170】【629151000030751†L228-L233】.

```json
PUT _index_template/logs-apm-template
{
  "index_patterns": ["logs-apm.*"],
  "data_stream": {},
  "template": {
    "mappings": {
      "dynamic_templates": [
        {
          "labels": {
            "path_match": "labels.*",
            "mapping": {
              "type": "keyword",
              "ignore_above": 256
            }
          }
        }
      ],
      "properties": {
        "@timestamp": { "type": "date" },
        "type": { "type": "keyword" },
        "service_name": { "type": "keyword" },
        "environment": { "type": "keyword" },
        "trace_id": { "type": "keyword" },
        "span_id": { "type": "keyword" },
        "level": { "type": "keyword" },
        "message": { "type": "text" },
        "http_method": { "type": "keyword" },
        "http_path": { "type": "keyword" },
        "http_status_code": { "type": "integer" }
      }
    }
  },
  "composed_of": [],
  "priority": 500
}
```

**설명**

- `dynamic_templates.labels` – 모든 `labels.*` 필드를 `keyword` 로 저장하여 집계·필터에 사용한다. 값 길이를 256자 이하로 제한한다.  
- `message`는 검색을 위해 `text` 타입을 사용했다. 필요시 `keyword` 서브필드를 추가해 정확도 위주의 검색을 지원할 수 있다.  
- `http_*` 필드는 HTTP 로그에만 존재한다. 다른 로그에는 나타나지 않는다.

### 2.2 스팬 템플릿

스팬은 `traces-apm.*` 데이터 스트림에 저장한다. Elastic 스펙에서 `trace.id`, `service.name` 등은 `keyword` 타입이다【629151000030751†L150-L170】【629151000030751†L228-L233】.

```json
PUT _index_template/traces-apm-template
{
  "index_patterns": ["traces-apm.*"],
  "data_stream": {},
  "template": {
    "mappings": {
      "dynamic_templates": [
        {
          "labels": {
            "path_match": "labels.*",
            "mapping": {
              "type": "keyword",
              "ignore_above": 256
            }
          }
        }
      ],
      "properties": {
        "@timestamp": { "type": "date" },
        "type": { "type": "keyword" },
        "service_name": { "type": "keyword" },
        "environment": { "type": "keyword" },
        "trace_id": { "type": "keyword" },
        "span_id": { "type": "keyword" },
        "parent_span_id": { "type": "keyword" },
        "name": { "type": "keyword" },
        "kind": { "type": "keyword" },
        "duration_ms": { "type": "double" },
        "status": { "type": "keyword" },
        "http_method": { "type": "keyword" },
        "http_path": { "type": "keyword" },
        "http_status_code": { "type": "integer" },
        "db_statement": { "type": "text", "index": false }
      }
    }
  },
  "composed_of": [],
  "priority": 500
}
```

**설명**

- `duration_ms`는 밀리초 단위 실수형(`double`)으로 저장한다.  
- `db_statement`는 검색을 비활성화하여 저장 크기만 유지한다. 필요 시 스팬 상세 화면에서만 확인한다.  
- 트랜잭션 수준 집계는 스팬 데이터를 이용해 계산한다. 개별 트레이스 문서(루트 스팬 요약)를 별도로 저장하지 않는다.

### 2.3 데이터 스트림 및 ILM 간단 규칙

- 데이터 스트림 명명법은 `<type>-apm.<dataset>-<namespace>`를 따른다【897321232077862†L831-L840】. 예: `logs-apm.order-service-prod`, `traces-apm-prod`.  
- 기본 ILM 정책은 로그를 14일, 트레이스를 7일 보관하는 정도의 단순 규칙으로 시작한다. 이후 트래픽에 따라 샘플링과 보존 기간을 조정할 수 있다.

## 3 백엔드 API를 위한 데이터 구조

NestJS 기반 백엔드에서 데이터 수집과 조회를 구현하기 위해 다음과 같이 DTO(Data Transfer Object)를 정의한다. 모든 DTO는 `class-validator`를 이용해 필수 필드를 검증하지만, MVP에서는 과도한 검증 로직을 피한다.

### 3.1 수집용 DTO

#### 3.1.1 `LogDto`

```ts
import { IsISO8601, IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class LogDto {
  readonly type = 'log';

  @IsISO8601()
  timestamp: string;

  @IsString()
  service_name: string;

  @IsString()
  environment: string;

  @IsIn(['DEBUG', 'INFO', 'WARN', 'ERROR'])
  level: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  trace_id?: string;

  @IsOptional()
  @IsString()
  span_id?: string;

  @IsOptional()
  @IsString()
  http_method?: string;

  @IsOptional()
  @IsString()
  http_path?: string;

  @IsOptional()
  http_status_code?: number;

  @IsOptional()
  @IsObject()
  labels?: Record<string, string | number | boolean>;
}
```

#### 3.1.2 `SpanDto`

```ts
import { IsISO8601, IsString, IsNumber, IsOptional, IsIn, IsObject } from 'class-validator';

export class SpanDto {
  readonly type = 'span';

  @IsISO8601()
  timestamp: string;

  @IsString()
  service_name: string;

  @IsString()
  environment: string;

  @IsString()
  trace_id: string;

  @IsString()
  span_id: string;

  @IsOptional()
  @IsString()
  parent_span_id?: string;

  @IsString()
  name: string;

  @IsIn(['SERVER', 'CLIENT', 'INTERNAL'])
  kind: 'SERVER' | 'CLIENT' | 'INTERNAL';

  @IsNumber()
  duration_ms: number;

  @IsIn(['OK', 'ERROR'])
  status: 'OK' | 'ERROR';

  @IsOptional()
  @IsString()
  http_method?: string;

  @IsOptional()
  @IsString()
  http_path?: string;

  @IsOptional()
  http_status_code?: number;

  @IsOptional()
  @IsObject()
  labels?: Record<string, string | number | boolean>;

  /**
   * 긴 쿼리 문자열이나 민감한 정보는 저장만 하고 검색하지 않기 위해 분리한다.
   */
  @IsOptional()
  @IsString()
  db_statement?: string;
}
```

### 3.2 조회용 DTO 및 API 설계

API는 읽기 전용으로 설계한다. 대표적인 엔드포인트와 응답 구조는 아래와 같다.

#### 3.2.1 `/traces/{traceId}` – 트레이스 조회

- **요청**: `GET /traces/{traceId}`  
- **응답**: 아래 `TraceResponse` 모델.

```ts
export interface SpanItem {
  timestamp: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  kind: string;
  duration_ms: number;
  status: string;
  service_name: string;
  environment: string;
  labels?: Record<string, string | number | boolean>;
}

export interface LogItem {
  timestamp: string;
  level: string;
  message: string;
  service_name: string;
  span_id?: string;
  labels?: Record<string, string | number | boolean>;
}

export interface TraceResponse {
  trace_id: string;
  spans: SpanItem[];
  logs: LogItem[];
}
```

컨슈머는 Elasticsearch에서 `traces-apm.*` 스트림에서 해당 `trace_id`의 스팬을 조회하고, `logs-apm.*`에서 같은 `trace_id`의 로그를 찾는다. 이 응답은 호출 그래프를 재구성할 수 있는 기본 정보를 제공한다.

#### 3.2.2 `/services/{serviceName}/metrics` – 메트릭 집계

메트릭은 개별 이벤트에서 파생된다. Query‑API는 Elasticsearch aggregation을 사용해 QPS, p95 latency, error rate 등을 계산하여 아래 구조로 반환한다.

```ts
export interface MetricPoint {
  timestamp: string;     // 버킷의 시작 시각
  value: number;         // 측정값
  labels?: Record<string, string>;
}

export interface MetricResponse {
  metric_name: string;     // ex: "http_requests_total", "latency_p95_ms", "error_rate"
  service_name: string;
  environment: string;
  points: MetricPoint[];
}
```

예를 들어 QPS를 계산할 때 Query‑API는 `kind=SERVER` 스팬을 1분 버킷으로 집계하여 `http_requests_total` 값을 반환한다. p95 latency는 `duration_ms`에 대해 `percentiles` 집계를 수행하고, 에러율은 `status='ERROR'` 스팬 비율로 계산한다. 메트릭 라벨(`labels`)은 HTTP 메서드나 엔드포인트 등 저카디널리티 필터에만 사용한다.

## 4 요약 및 개발 지침

- **데이터 수집 범위** – Logs와 Spans만 수집하며, Metrics는 나중에 집계한다. 각각의 데이터 예시는 위 JSON을 참고한다.  
- **불필요한 필드 제거** – 수집 시점에 `db.connection_string`, `db.statement` 등 고카디널리티 또는 민감한 정보는 제외한다.  
- **Elasticsearch 구조** – 데이터 스트림을 사용해 `logs-apm.*`와 `traces-apm.*`에 저장한다【897321232077862†L819-L827】. 공통 필드는 `keyword`와 `date` 타입으로 매핑한다【629151000030751†L150-L170】【629151000030751†L228-L233】. `labels.*`는 `keyword`로 동적 매핑한다.  
- **백엔드 구현** – NestJS DTO와 컨트롤러/서비스 계층을 이용해 자료형을 검증하고 분리한다. Producer → Kafka → Consumer → Elasticsearch 파이프라인에서 데이터 가공을 최소화하고, Query‑API는 Elasticsearch DSL 집계로 메트릭을 계산한다.  

이 문서를 기반으로 직접 코드를 작성하면, 3주짜리 MVP에서도 확장 가능하고 유지보수성 높은 APM 시스템을 구현할 수 있다.
