# APM 프로젝트를 위한 ChatGPT·Codex 지침

이 문서는 APM 프로젝트를 원활히 수행하기 위한 **ChatGPT**(웹 인터페이스)와 **Codex**(프로젝트 루트에서 실행할 CLI)용 지침입니다. 두 도구는 한 팀처럼 협업하며, 세부 사항을 준수해 짧은 기간 내에 최소 기능 제품(MVP)을 완성하는 것을 목표로 합니다. 아래의 지침은 프로젝트 구성, 관찰 데이터 정의와 저장 구조, 구현 전략, 코딩 원칙, 두 도구의 역할과 협업 방법을 명확히 설명합니다. 필요 시 최신 정보 검색이나 문서 참고를 통해 보완합니다.

## 1. 프로젝트 개요

### 1.1 시스템 구성

APM은 **fluent‑bit**와 **OpenTelemetry Collector**와 같은 수집기로부터 **Logs**, **Metrics**, **Traces** 및 **Spans** 데이터를 수집합니다. 데이터는 다음과 같은 단계로 흐릅니다:

1. **Producer (NestJS)** – 수집된 데이터를 받아 카프카에 발행합니다.
2. **Kafka** – 고성능 분산 메시징 플랫폼으로 데이터를 버퍼링하고 전송합니다. 카프카는 스트림을 퍼블리시·서브스크라이브, 저장 및 실시간 처리할 수 있는 플랫폼으로 설계되었습니다【550419036444003†L224-L233】.
3. **Stream-Processor (NestJS)** – 카프카에서 메시지를 소비하고 데이터를 정제한 후 Elasticsearch에 색인하는 쓰기 전용 서버입니다.
4. **Query‑API (NestJS)** – 브라우저/클라이언트 요청에 따라 Elasticsearch에서 검색·집계만 수행하는 읽기 전용 서버입니다.
5. **Elasticsearch** – 관찰 데이터 저장소로, 분산 검색·집계에 최적화되어 있습니다. 데이터 스트림을 이용해 로그, 메트릭, 트레이스를 분리 저장합니다【897321232077862†L819-L827】.

### 1.2 MVP 개발 범위

이번 프로젝트는 두 명의 인원이 3주 동안 수행하는 MVP입니다. 따라서:

* **핵심 기능에 집중합니다.** 데이터 수집과 저장, 기본 검색·집계가 동작하는지 확인합니다. UI나 복잡한 알람 시스템, 대시보드는 후순위입니다.
* **과도한 기능 추가를 피합니다.** 코드 및 구성 파일은 최소한의 책임만 수행하며, 필요 이상의 설정값, 플러그인, 커스텀 로직을 넣지 않습니다.
* **확장성을 염두에 둡니다.** MVP라도 SOLID 원칙을 지켜 추후 기능 추가나 리팩터링이 수월하도록 설계합니다.

## 2. 관찰 데이터 정의 및 저장 설계

### 2.1 Logs, Metrics, Traces, Spans 정의

아래 정의는 APM 프로젝트 전반에 걸쳐 사용되며, 저장 구조와 집계 로직에 직접적인 영향을 줍니다.

| 타입    | 요약 정의 | 예시 및 핵심 필드 |
|---------|-----------|------------------|
| **Log** | 특정 시점에 발생한 이벤트를 텍스트나 JSON 형태로 기록한 것입니다. 로그는 디버깅이나 이벤트 추적에 사용되며 `timestamp`, `level`, `service.name`, `trace.id`, `span.id` 등의 필드를 포함합니다. | 예: `{"timestamp":"2025-11-09T10:15:32Z","level":"INFO","service.name":"order-service","trace.id":"b7f3…","message":"Created order"}` |
| **Metric** | 집계 가능한 숫자 값의 시계열 데이터입니다. 메트릭은 CPU 사용률, 요청 수, 지연 시간(p95/p90/p50) 등 시스템 상태를 추상화합니다. 고카디널리티를 피하도록 레이블을 신중히 설계합니다. | 예: `{"metric.name":"http.server.requests.count","service.name":"order-service","labels":{"path":"/orders","status":"2xx"},"value":152}` |
| **Trace** | 하나의 요청·트랜잭션 전체 여정을 표현하는 상위 개념입니다. 단일 `trace.id`에 여러 스팬이 속하며 분산 시스템의 호출 그래프를 복원할 수 있습니다. | 예: `trace_id=b7f3…`에 루트 스팬(HTTP 요청)과 하위 스팬(DB 호출, 외부 결제 호출 등)이 포함됩니다. |
| **Span** | Trace를 구성하는 가장 작은 단위의 작업입니다. `span.id`, `parent.id`, `service.name`, `start_time`, `end_time`, `attributes`를 갖습니다. 스팬들의 트리로 전체 트레이스를 재구성합니다. | 예: `{"span.id":"payment-1","parent.id":"order-1","service.name":"payment-service","span.name":"ChargeCard","attributes":{"payment.amount":39000}}` |

이 네 가지 데이터는 서로 연결되어야 합니다. 로그·메트릭·스팬에 공통적으로 **`trace.id`**, **`span.id`**를 포함해 같은 요청을 추적할 수 있도록 합니다.

### 2.2 Elasticsearch 저장 구조 설계

Elasticsearch는 **데이터 스트림**을 사용해 시계열 데이터를 효율적으로 저장합니다. 데이터 스트림은 숨겨진 백업 인덱스들의 논리적 집합으로, 자동 롤오버·ILM(인덱스 수명 주기 관리)을 쉽게 적용할 수 있습니다. Elastic 문서는 데이터 스트림이 로그, 메트릭, 트레이스 같은 계속 생성되는 데이터에 적합하고, 필드 수 감소, 세밀한 데이터 제어, 유연한 명명 규칙 등의 장점을 제공한다고 설명합니다【897321232077862†L819-L827】.

#### 2.2.1 데이터 스트림 네이밍 스킴

APM 데이터 스트림의 이름은 `<type>-<dataset>-<namespace>` 형식을 따릅니다【897321232077862†L831-L840】. 여기서:

* **type**: `logs`, `metrics`, `traces`
* **dataset**: APM 플러그인이 정의한 세부 데이터셋(`apm.error`, `apm.transaction`, `apm.service_summary` 등)
* **namespace**: 환경(`dev`, `stage`, `prod`) 또는 사업부 등 자유롭게 지정

예를 들어 **생산 환경의 주문 서비스 로그**는 `logs-apm.app.order-service-prod`에, **트레이스 데이터**는 `traces-apm-prod`에, **내부 메트릭**은 `metrics-apm.internal-prod`에 저장됩니다【897321232077862†L846-L895】. 서비스 이름에 대문자나 특수문자가 포함되면 밑줄로 변환되므로, 애초에 소문자와 간결한 이름을 사용합니다【897321232077862†L870-L879】.

#### 2.2.2 공통 필드와 매핑

모든 데이터 스트림에 다음 공통 필드를 포함해야 합니다:

* `@timestamp` – 이벤트 발생 시간 (ISO8601)
* `trace.id` – 트레이스 식별자
* `span.id` – 스팬 식별자 (해당되는 경우)
* `service.name`, `service.environment`, `service.version`
* `host.name`, `container.id`, `kubernetes.*` – 배포 환경 식별자
* `labels` – 추가 메타데이터 (카디널리티 관리 필수)

Logs, Metrics, Traces 각각의 인덱스 템플릿에서 위 필드는 `keyword` 또는 `date` 타입으로 지정합니다. 로그 도큐먼트에는 `log.level`, `message`, `error.*`, HTTP 필드 등을, 메트릭 도큐먼트에는 `metric.name`, `metric.unit`, `value` 등을 추가합니다. 트레이스(스팬) 도큐먼트에는 `event.duration`(나노초), `parent.id`, `transaction.id`, `span.name`, `span.type` 등을 포함합니다. 데이터 구조와 예시는 앞선 설명을 참고해 표준화합니다.

#### 2.2.3 인덱스 수명 주기(ILM)

MVP 단계에서는 기본 ILM 정책을 사용해 저장 비용을 관리합니다. 예를 들어 **logs**는 14일 보관 후 삭제, **traces**는 7일간 전체 저장 후 샘플링·압축, **metrics**는 최대 90일 보관 등 단순한 규칙을 적용할 수 있습니다. 세부 정책은 추후 확장 시 조정합니다.

## 3. 구현 가이드라인

### 3.1 공통 코딩 원칙 (NestJS + TypeScript)

1. **SOLID 준수** – NestJS는 의존성 주입과 데코레이터가 잘 설계되어 있어 SOLID를 적용하기 쉽습니다. 
   - 각 원칙(단일 책임, 개방/폐쇄, 리스코프 치환, 인터페이스 분리, 의존 역전)을 지키면 코드가 간결하고 확장 가능해집니다. NestJS 애플리케이션을 유지보수하기 위해 이러한 원칙이 검증된 방법임을 강조합니다【497485247725756†L229-L233】. 예를 들어, 컨트롤러는 HTTP 요청만 처리하고 비즈니스 로직은 서비스로 분리하며, 인터페이스를 사용해 테스트 시 구현을 손쉽게 교체할 수 있습니다【497485247725756†L243-L347】.
2. **모듈 간 결합 최소화** – 각 모듈(AppModule, ProducerModule, ConsumerModule, QueryModule 등)은 의존성 주입을 통해 서로를 느슨하게 연결합니다. 공통 인터페이스와 DTO만 공유하고 내부 구현은 은닉합니다. 특정 서비스에만 필요한 설정이나 로직을 다른 모듈에 노출하지 않도록 합니다.
3. **단순한 설정** – Kafka 연결, Elasticsearch 클라이언트 설정 등은 별도의 `ConfigurationService`에서 환경 변수로만 관리하고, 복잡한 동적 로직을 추가하지 않습니다. NestJS 문서에 따라 Kafka 마이크로서비스는 `Transport.KAFKA`와 `brokers` 옵션만으로도 기본 설정이 가능하며【550419036444003†L244-L269】, 필요 이상으로 세부 옵션을 조정하지 않습니다. ElasticSearch도 클러스터 주소, 인증 정보, 인덱스 네임 정도만 설정합니다.
4. **DTO와 유효성 검사** – 생산자/소비자/쿼리 API에서 사용하는 입력 데이터는 DTO 클래스로 정의하고 `class-validator`와 `pipes`를 이용해 필수 필드를 확인합니다. 단, MVP에서는 과도한 유효성 검사나 커스텀 변환을 추가하지 않고 기본 타입 확인에 그칩니다.
5. **구조화 로그** – 모든 서비스는 Winston 또는 Pino와 같은 로거를 사용해 JSON 형식으로 로그를 남깁니다. 로그에는 `trace.id`와 `span.id`를 포함하여 트레이스와 연동이 가능하도록 합니다.
6. **에러 처리** – NestJS의 ExceptionFilter를 이용해 에러를 전역 처리하며, 생산자/소비자에서 처리하지 못한 에러는 잡아 JSON 형태로 로깅하고 카프카 메시지 실패를 방지합니다.
7. **테스트** – Jest 기반 단위 테스트를 작성하되, MVP 범위에서는 핵심 로직(파싱, 매핑, 프로듀싱/컨섬)만 테스트합니다. 추후 통합 테스트 추가를 고려합니다.

### 3.2 프로듀서 구현 (Producer – NestJS)

1. **마이크로서비스 설정** – NestJS에서 카프카 프로듀서를 만들 때 `NestFactory.createMicroservice`를 사용하고 `Transport.KAFKA`를 지정합니다【550419036444003†L244-L269】. `brokers`는 환경 변수에서 읽어옵니다. `clientId`와 `producerOnlyMode`를 설정해 소비자 그룹에 가입하지 않는 순수 프로듀서로 구현합니다.
2. **데이터 수신** – Fluent‑bit나 OTel Collector에서 수집한 데이터를 HTTP나 gRPC로 수신할 경우, NestJS `Controller`와 `Service`로 분리합니다. 컨트롤러는 요청을 DTO로 변환하고 서비스는 카프카에 메시지를 발행합니다. 이때 메시지 헤더에 OpenTelemetry의 `traceparent`를 포함시켜 컨텍스트를 전파합니다【701703879168268†L165-L183】.
3. **Kafka 발행** – `@nestjs/microservices`의 `ClientKafka`를 주입 받아 사용합니다. 토픽 이름은 관찰 데이터 타입에 따라 `logs`, `metrics`, `traces` 등으로 분리합니다. 메시지 본문은 구조화된 JSON이며, 필요한 필드를 검증 후 그대로 전송합니다.
4. **OpenTelemetry 연동** – 프로듀서 모듈에는 `NodeSDK`를 초기화하고 `NestInstrumentation`, `HttpInstrumentation`, `ExpressInstrumentation`, `KafkaJsInstrumentation`을 설정합니다【701703879168268†L165-L183】. 이를 통해 HTTP 요청과 카프카 발행 과정 모두에서 스팬을 자동 생성하고 `traceparent` 헤더를 추가합니다.

### 3.3 카프카 (중앙 메시징 버스)

* 카프카는 퍼블리시·서브스크라이브와 durable storage를 제공하는 플랫폼이며, 실시간 데이터 처리에 적합합니다【550419036444003†L224-L233】. 토픽과 파티션 설계를 단순화해, `logs`, `metrics`, `traces` 3개 토픽(각각 몇 개의 파티션)으로 나누는 방식을 권장합니다. 후속 서비스 확장 시 파티션 개수를 늘립니다.
* 테스트 환경은 도커‑컴포즈를 이용해 zookeeper, kafka, kafka-ui 등을 구성할 수 있으며, 예제에서는 `brokers: ['kafka:29092']` 식으로 설정합니다【701703879168268†L214-L234】.

### 3.4 컨슈머 구현 (Stream-Processor – NestJS)

1. **마이크로서비스 설정** – `NestFactory.createMicroservice`에 `Transport.KAFKA`와 `consumer.groupId`를 지정하여 컨슈머를 만듭니다. 각 서비스는 고유 그룹ID를 사용하여 토픽 메시지를 모두 처리합니다. 필요하다면 동적 파티션 분배를 방지하기 위해 NestJS의 커스텀 파티셔너를 사용할 수 있습니다【550419036444003†L352-L383】.
2. **메시지 파싱** – 카프카 메시지에서 `key`, `value`, `headers`는 Buffer 타입으로 전달되므로, NestJS는 문자열로 변환 후 JSON 파싱을 시도합니다【550419036444003†L420-L437】. 컨슈머 서비스는 이 구조화된 데이터를 도메인 객체로 매핑합니다. 과도한 정규화나 추가 파싱 로직을 피합니다.
3. **데이터 정제** – 수신된 JSON에 기본 필드(`@timestamp`, `trace.id`, `span.id`, `service.name` 등)가 존재하는지 확인하고, 누락 시 필수값만 채웁니다. 추가 가공은 최소화하여 Elastic에 인덱싱 가능한 형태로 변환합니다.
4. **Elasticsearch 인덱싱** – `@elastic/elasticsearch` 클라이언트를 사용하여 배치로 문서를 전송합니다. 데이터 스트림 이름은 메시지 타입과 서비스 환경에 따라 결정합니다. 인덱싱 에러는 재시도 로직을 간단히 구현하거나 Dead Letter Queue로 전송합니다.
5. **OpenTelemetry 연동** – 컨슈머도 프로듀서와 동일한 SDK 설정을 사용하여 카프카 메시지를 소비할 때 스팬을 생성하고, 컨텍스트를 유지합니다. 메시지 헤더에서 `traceparent`를 읽어 `parent_span_id`로 설정합니다【701703879168268†L137-L152】.

### 3.5 Query‑API 구현 (NestJS)

1. **읽기 전용 설정** – Query‑API는 HTTP 서버 형태로 동작하며, Elasticsearch 클라이언트로 검색과 집계만 수행합니다. 쓰기, 삭제 등은 허용하지 않습니다.
2. **엔드포인트 설계** – 주요 엔드포인트는 아래와 같습니다:
   - `/traces/{traceId}` – 특정 트레이스의 모든 스팬과 관련 로그를 조회합니다.
   - `/services/{serviceName}/metrics` – 서비스의 메트릭(p95/p90/p50 latency, error rate 등)을 집계하여 반환합니다.
   - `/logs/search` – 조건(기간, 서비스, level 등)에 따른 로그 검색.
3. **ES 쿼리 추상화** – 쿼리 로직은 Repository 계층에서 관리하여 컨트롤러가 단순해지도록 합니다. 쿼리 문자열을 하드코딩하지 말고 파라미터에 따라 동적으로 작성하지만, 복잡한 DSL을 사용자에게 노출하지 않습니다.
4. **성능 최적화** – 검색 결과는 pagination(`from`/`size` 또는 `search_after`)을 지원하고, 집계는 시간 버킷을 사용하여 메트릭을 효율적으로 계산합니다. 필요 시 캐싱을 도입합니다.
5. **CORS 구성** – Query‑API는 `CORS_ALLOWED_ORIGINS` 환경 변수를 통해 허용 오리진을 콤마(`,`)로 구분하여 지정합니다(예: `https://www.jungle-panopticon.cloud,http://localhost:3000`). 값이 없으면 전체 오리진을 허용하여 로컬 개발을 지원합니다.
6. **환경 별칭** – `environment` 파라미터는 `prod`/`stage`/`dev` 같은 축약형을 `production`/`staging`/`development`로 자동 정규화하여 필터링합니다. 저장된 값과 동일한 문자열을 보내도 되고, 축약형으로 보내도 동일한 결과를 얻습니다.

### 3.6 공통 Instrumentation (OpenTelemetry)

* **SDK 초기화** – 각 마이크로서비스에서 애플리케이션 시작 시 `@opentelemetry/sdk-node`의 `NodeSDK`를 생성합니다. `traceExporter`는 OTLP gRPC/HTTP exporter를 사용하여 수집기가 받아볼 수 있도록 합니다.
* **Instrumentations 추가** – `instrumentations` 배열에 `NestInstrumentation`, `HttpInstrumentation`, `ExpressInstrumentation`, `KafkaJsInstrumentation`을 추가합니다【701703879168268†L165-L183】. 이를 통해 HTTP 요청·응답, Express 미들웨어, NestJS 내부, Kafka 생산·소비 로직에서 스팬이 자동으로 생성됩니다.
* **컨텍스트 전파** – Kafka 메시지 헤더에 `traceparent` 값을 포함하여 컨슈머가 부모 스팬을 연결할 수 있도록 합니다【701703879168268†L137-L152】. OTel JS SDK는 이를 자동으로 처리합니다. 수집기(Collector)는 Jaeger, OTLP exporter 등을 통해 트레이스를 수집합니다.
* **메트릭 수집** – 필요 시 `@opentelemetry/api-metrics`를 사용해 HTTP 지연 시간, 카프카 큐 길이 등의 메트릭을 기록합니다. 그러나 MVP에서는 기본 지표만 수집해도 충분합니다.

### 3.7 Error Stream 서버 (Kafka → WebSocket)

* **역할** – `apm.logs.error` 토픽을 구독하여 `ERROR_STREAM_WS_PATH`(기본 `/ws/error-logs`) 엔드포인트로 접속한 NEXT.js 프런트엔드에 실시간으로 push 합니다.
* **Kafka 설정** – `ERROR_STREAM_KAFKA_CLIENT_ID`, `ERROR_STREAM_KAFKA_GROUP_ID`, `KAFKA_APM_LOG_ERROR_TOPIC`(기본 `apm.logs.error`) 환경 변수를 통해 MSK 접속 정보를 분리합니다. 기존 `KAFKA_*` 보안 설정(SSL/SASL)은 `shared/common/kafka` 모듈을 그대로 사용합니다.
* **WebSocket 보안** – `ERROR_STREAM_WS_ORIGINS`에 허용 오리진을 콤마로 지정합니다. 설정이 비어 있으면 로컬 개발 편의를 위해 모든 오리진에서 연결할 수 있도록 설정됩니다.
* **배포** – Query‑API, Stream Processor와 동일하게 독립 Docker 타깃(`error-stream`)과 ECR/ECS 태스크 정의를 사용합니다. 포트는 `ERROR_STREAM_PORT`(기본 3010)으로 노출합니다.

## 4. ChatGPT 지침 (웹 인터페이스)

1. **정확한 정보 제공** – 사용자 질문에 답할 때, 지식 컷오프 이후의 정보나 시간에 민감한 내용이 나오면 먼저 검색 도구를 이용해 최신 자료를 찾아 인용합니다. 카프카, Elastic, OTel 버전 업데이트 등은 최신 정보를 확인해야 합니다.
2. **논리적·비판적 응답** – 사용자가 제안한 설계나 코드에 잠재적 문제(예: 고카디널리티 라벨, 과도한 기능 추가, 성능 병목)를 발견하면 이유를 논리적으로 설명하고 대안을 제시합니다. 무비판적으로 동의하지 않습니다.
3. **SOLID와 간결성 유지** – 코드 예시나 설계를 제시할 때 단일 책임을 지키고 모듈 간 결합을 최소화합니다. 불필요한 추상화나 복잡성은 피합니다. 예를 들어 Kafka 설정은 NestJS 기본 옵션만 보여주고 필요 이상의 설정은 생략합니다.
4. **구조화와 명확성** – 답변은 서론·본론·결론 구조로 명확히 구분하고, 표나 리스트는 키워드·숫자만 포함하도록 합니다(긴 문장 X). 긴 설명은 본문에 기술합니다.
5. **예시와 패턴 제공** – 필요 시 간단한 코드 스니펫(모듈 생성, DTO 정의, 서비스 초기화 등)을 제공하지만, 핵심 로직과 패턴에 집중합니다. 전체 애플리케이션을 작성하지 않고 skeleton을 제시하는 데 그칩니다.
6. **지속적 개선 제안** – MVP가 완료된 후 성능 향상, 보안 강화, 고가용성 확보 방법 등을 제안할 수 있습니다. 하지만 현재 범위를 넘는 요구가 나오면 이유를 설명하고 MVP에 필요한 최소 사항만 수행합니다.

## 5. Codex 지침 (CLI 활용)

1. **프로젝트 구조 관리** – CLI는 실제 코드 파일을 작성·수정·삭제하는 역할을 합니다. 폴더 구조를 명확히 하고, 각 마이크로서비스는 독립된 NestJS 프로젝트(예: `producer`, `consumer`, `query-api`)로 구성하거나 모노레포 내에서 도메인별 모듈로 관리합니다.
2. **명령 실행** – 패키지 설치(`npm install kafkajs @opentelemetry/sdk-node @elastic/elasticsearch` 등), NestJS CLI 생성(`npx nest new` 또는 `nest g module service` 등), 빌드·테스트 명령 등을 수행합니다. 명령 실행 전에는 필요한 옵션을 설정하고, 실행 후 결과를 확인합니다.
3. **파일 수정** – 코드 변경 시 `apply_patch` 형식으로 패치를 작성하여 클래스, 모듈, DTO, 테스트 파일 등을 업데이트합니다. 코드는 TypeScript로 작성하고, NestJS 데코레이터와 의존성 주입을 활용해 SOLID 원칙을 지킵니다.
4. **즉각적인 결과 제공** – CLI는 비동기 작업을 미루지 않습니다. 명령 실행 결과는 즉시 사용자에게 보고하며, 시간 소요를 예측해 기다리라고 안내하지 않습니다.
5. **검색·외부 의존성** – CLI는 인터넷에 접근하지 못하므로, 패키지 버전이나 외부 API 정보가 필요하면 ChatGPT가 먼저 검색 후 공유해야 합니다. CLI는 그 정보에 기반해 작업합니다.
6. **검증 및 테스트** – 코드 작성 후 `npm run test`로 핵심 테스트를 돌려 성공 여부를 확인합니다. 실패 시 오류 메시지를 공유하고 수정합니다. 린트 도구(ESLint)나 포매터(Prettier)를 적용해 일관된 코드 스타일을 유지합니다.
7. **환경 변수 관리** – `.env` 파일이나 `ConfigService`를 통해 카프카 브로커 주소, Elasticsearch 호스트, OTLP exporter URL 등을 설정합니다. CLI는 환경 파일을 생성하거나 업데이트할 수 있습니다.

## 6. 추가 고려 사항 및 권장 사항

* **보안** – MVP에서도 민감한 데이터가 로그나 트레이스에 노출되지 않도록 주의합니다. 예를 들어 사용자 개인정보, 결제 정보 등은 `attributes`나 `labels`에 직접 저장하지 않고 마스킹하거나 제외합니다.
* **고카디널리티 방지** – 사용자 ID, 주문 ID 등 가변성이 큰 값은 메트릭 라벨로 사용하지 않고, 로그나 스팬의 `labels`에 포함합니다. Elastic 검색 시 필요한 경우 `terms` 쿼리로 필터링합니다.
* **샘플링** – 트레이스 데이터는 볼륨이 크므로, Collector나 SDK 수준에서 확률적 샘플링을 적용해 저장 부담을 줄입니다. 에러·고지연 스팬은 항상 수집하도록 규칙을 설정할 수 있습니다.
* **확장 및 유지보수** – MVP 이후에는 로그/메트릭/트레이스에 대한 알람, 대시보드, 보안, 멀티테넌시 등을 고려해야 합니다. 그러나 지금은 핵심 파이프라인을 구축하는 데 집중합니다.

---

이 지침은 프로젝트 기간 동안 ChatGPT와 Codex가 일관되게 참고할 핵심 문서입니다. 각 도구는 역할을 명확히 분리하여 협력하고, NestJS 기반의 APM 시스템을 **단순하지만 확장 가능한 형태로** 구현하는 데 집중해야 합니다. 필요 시 Elastic 문서나 NestJS 공식 문서를 추가로 참고하여 최신 정보를 반영합니다.
