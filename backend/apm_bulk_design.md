# Design Specification: Bulk + Limited Concurrency Ingestion for Elasticsearch

## 배경과 기존 문제

현행 APM 파이프라인은 Kafka에서 로그 메시지를 하나씩 읽어와 `index()` API로 Elasticsearch(E) 데이터스트림에 저장한다. 네트워크 왕복을 매 메시지마다 수행하고, 단건 `index()`가 끝날 때까지 기다린 뒤 다음 메시지를 처리하는 구조 때문에 초당 처리량이 낮고 병렬성이 사실상 없었다. 특히 수십만 건 이상의 로그를 처리할 때 소비자 스레드가 몇 시간 동안 대기하는 현상이 발생하였다. Elastic API 문서는 대규모 데이터 적재 시 단건 `index()` 대신 Bulk API를 사용해야 네트워크 오버헤드를 줄이고 색인 속도를 높일 수 있다고 강조한다【102369654029175†L753-L762】. 그리고 적절한 배치 크기를 찾기 위해 실험이 필요하며, HTTP 요청은 100 MB를 넘지 않도록 주의해야 한다【102369654029175†L753-L757】. 또한 다른 사용자들도 네트워크 왕복을 아끼기 위해 Bulk API를 병렬로 실행하면서 적당한 청크 크기(1 MB–10 MB)와 적정 동시 플러시 수를 찾아야 한다고 조언한다【750595237790637†L52-L61】.

본 문서는 이러한 문제를 해결하고, **대량 로그(수십만~수백만 건)도 빠르게 색인하면서 at‑least‑once 보장**을 유지하는 아키텍처를 설계한다. Node (NestJS) + Kafka + Elasticsearch 환경을 대상으로 하지만, 설계 개념은 다른 언어와 프레임워크에도 적용 가능하다.

## 목표

- Kafka에서 들어오는 로그를 **at‑least‑once**로 Elasticsearch에 저장하고, 색인 실패 시 재처리를 지원한다.
- **Bulk API**를 사용하여 단건 요청 대비 색인 속도를 크게 높인다. Medium 기사에서도 bulk indexing이 단건 저장보다 훨씬 빠르다고 강조한다【85091753486274†L114-L120】. Python 테스트에서도 1000개 문서를 단건으로 index 하는 데 124 초가 걸린 반면, `streaming_bulk`는 0.67 초, `parallel_bulk`는 0.46 초만에 끝났다【596974854923973†L30-L124】.
- 과도한 동시성으로 Elasticsearch 클러스터를 과부하하지 않도록 **동시 플러시 수를 제한**한다. 실제 사례에서도 32개의 동시 프로세스로 색인하던 것을 1개 프로세스로 줄이자 클러스터 지표가 크게 개선되었다【901591924758741†L125-L143】.
- Kafka consumer가 색인을 기다리지 않고 무제한으로 enqueue하여 메모리를 고갈시키는 일을 방지하기 위해 **back‑pressure** 메커니즘을 도입한다.
- 로그 데이터 변환/검증 과정과 색인 과정의 책임을 분리하여 재사용성을 높이고, 서비스 코드와 분리된 Bulk 인덱싱 모듈을 제공한다.

## 아키텍처 개요

### 데이터 흐름

```
Kafka (topic: apm.logs) ──> NestJS consumer ──> DTO 변환/검증 ──> BulkIndexer (버퍼/플러시) ──> Elasticsearch 데이터스트림
```

![Bulk ingestion flow]({{file:file-3hAzDofY4oYDp2MfohfxJ2}})

1. **Kafka consumer**는 메시지를 받아 DTO 변환 및 필수 검증을 수행한다. 검증에서 오류가 발생하면 해당 메시지를 건너뛰고 Kafka offset을 커밋한다.
2. DTO를 Elasticsearch 문서 구조(`LogDocument`)로 매핑한 뒤 **BulkIndexer**에 enqueue 한다. 이 단계에서는 실제 색인 작업을 수행하지 않고, 메모리 버퍼에 문서와 offset 정보를 저장한다. enqueue 호출은 `Promise`를 반환하며, 문서가 색인되면 resolve되고 실패 시 reject된다.
3. **BulkIndexer**는 배치 크기 또는 시간 조건이 만족될 때 버퍼에 쌓인 문서를 `_bulk` API로 전송한다. 클라이언트는 `Content‑Type: application/x‑ndjson`를 사용하여 NDJSON 포맷으로 전송해야 한다는 Elastic 문서를 준수한다【102369654029175†L738-L752】.
4. Flush 결과를 보고 개별 문서의 `resolve/reject`를 호출한다. 한 아이템이라도 실패하면 단순화된 전략으로 모든 문서를 실패로 취급하여 Kafka 재처리를 유도한다. 이로써 at‑least‑once 보장을 유지하지만 중복 삽입 가능성을 인정한다.
5. Consumer handler는 enqueue 반환값을 `await`하므로, 문서가 성공적으로 색인돼야만 offset을 커밋한다. 실패 시 예외를 발생시켜 Kafka consumer가 재시도하게 한다.

### BulkIndexer 버퍼 설계

BulkIndexer는 싱글톤 서비스로서 다음과 같은 상태를 가진다:

- `buffer: Array<BufferedItem>` — 각 항목은 `document`, Kafka offset 메타데이터, `resolve`/`reject` 콜백을 포함한다.
- `flushTimer: NodeJS.Timeout | null` — 시간 기반 플러시 예약용 타이머.
- `inFlightFlushes: number` — 현재 진행 중인 flush의 수. `MAX_PARALLEL_FLUSHES` 한도를 초과하면 새 flush를 미뤄서 클러스터 과부하를 방지한다.

#### enqueue 동작

`enqueue(document, offsetInfo): Promise<void>`는 다음과 같이 동작한다.

1. `Promise<void>`를 생성하고, `resolve`/`reject`를 `BufferedItem`에 저장한다.
2. `buffer`에 아이템을 추가한다.
3. 버퍼 길이가 `BATCH_SIZE` 이상이면 즉시 `flush()`를 시도한다. `flush()`는 `inFlightFlushes < MAX_PARALLEL_FLUSHES`일 때만 실행되며, 그렇지 않으면 다음 enqueue 또는 timer에서 재시도한다.
4. `flushTimer`가 설정되어 있지 않으면 `setTimeout(flush, FLUSH_INTERVAL_MS)`를 등록하여 일정 시간이 지나도 남아있는 문서를 flush할 수 있게 한다.
5. `Promise`를 반환하여 consumer handler가 `await`할 수 있도록 한다.

#### flush 동작

`flush()`는 버퍼에서 현재 쌓여있는 항목을 모두 꺼내 하나의 bulk 요청으로 전송한다.

- 메모리 버퍼는 매 flush 후 비워진다. 다른 메시지가 들어오면 새 버퍼에서 다시 쌓인다.
- `_bulk` 요청은 NDJSON 형식으로 `{ "index" : {"_index": data_stream} }\n{document}\n` 패턴으로 구성한다.
- HTTP 요청은 100 MB를 넘지 않도록 해야 한다는 Elastic 문서를 준수한다【102369654029175†L753-L757】. 배치 크기 기준은 문서 수(`BATCH_SIZE`) 또는 추정 바이트 수(예: 5 MB)를 동시에 고려할 수 있다.
- 요청 결과에서 `errors` 필드가 `true`이면 **간단한 전략으로 전체 배치를 실패로 간주**한다. Jörg Prante의 조언처럼 하나의 bulk 내 아이템들이 실패하면 동시에 재시도하는 것이 구현을 단순화한다【750595237790637†L52-L61】.
- 성공 시 각 아이템의 `resolve()`를 호출하여 consumer handler가 정상적으로 offset을 커밋할 수 있도록 한다. 실패 시 `reject()`를 호출하여 예외를 propagate 하고 Kafka에서 재처리한다.

#### 플러시 조건

- `BATCH_SIZE` (문서 개수 기준): 500 ~ 1000개부터 시작하여 환경에 따라 조정한다. Elastic 커뮤니티에서는 1 MB ~ 10 MB 정도의 bulk 크기를 권장하며, 너무 큰 청크(예: 64 MB 이상)는 GC나 heap 부하를 유발할 수 있다고 한다【750595237790637†L52-L61】.
- `FLUSH_INTERVAL_MS` (시간 기준): 배치 크기에 도달하지 않더라도 일정 시간(예: 1000 ms) 이상 버퍼에 머무는 문서가 있으면 flush한다. 낮은 트래픽 환경에서 문서가 너무 오래 지연되는 것을 막는다.
- `MAX_PARALLEL_FLUSHES`: 동시에 몇 개의 bulk 요청을 허용할지 제어한다. 값이 1이면 한 번에 하나만 flush하고, 나머지는 버퍼에 대기한다. 높은 동시성을 주려면 2 ~ 4까지 늘리고, 클러스터에서 429 (too many requests) 에러가 발생하면 줄인다【85091753486274†L118-L129】.

### Kafka offset 커밋 전략

NestJS Kafka 마이크로서비스는 handler가 `Promise`를 반환하고 예외를 발생시키는지 여부를 기준으로 offset을 커밋하거나 재처리한다. 따라서 bulk flush 결과가 성공했을 때만 enqueue에서 반환된 `Promise`를 resolve하고, 메시지 처리 함수(`handleLogEvent`)는 `await`를 통해 색인 완료를 보장해야 한다. 실패 시 reject하여 예외가 전파되면 offset이 커밋되지 않고 Kafka가 재전송한다. 이 방식은 **at‑least‑once** 보장을 유지하는 동시에 기본 NestJS API를 변경하지 않아 구현이 간단하다.

### 오류 처리 전략

1. **DTO 검증 오류**: 현재 구조처럼 `InvalidLogEventError`를 구분하여 메시지를 skip 하고 성공적으로 offset을 커밋한다. 잘못된 이벤트는 재시도해도 성공할 가능성이 없으므로 유실을 허용한다.
2. **bulk 전체 실패(네트워크 오류 등)**: flush한 모든 문서를 실패로 간주하고 각 `reject`를 호출한다. Kafka에서는 재처리되어 중복 색인이 발생할 수 있으나 로그 데이터는 idempotent하지 않아도 되므로 허용한다.
3. **bulk 부분 실패**: Elasticsearch 응답에서 `errors`가 `true`일 때 성공/실패 항목을 따로 구분할 수 있다. 구현이 복잡해지므로 초기에는 **전체 배치를 실패**로 간주하는 단순 전략을 사용한다. 향후 요구 사항에 따라 실패한 문서만 재처리하거나 별도의 DLQ(Dead Letter Queue)를 도입할 수 있다.

### 동시성 및 back‑pressure

노드 프로세스는 이벤트 루프를 사용하므로 무제한으로 I/O를 발행할 경우 메모리나 소켓 수가 고갈될 수 있다. 따라서 BulkIndexer는 `MAX_PARALLEL_FLUSHES`를 통해 한 번에 수행할 flush 수를 제한한다. 버퍼에 데이터가 넘치면 Kafka consumer는 자연스럽게 `await enqueue` 호출에서 대기하게 되어 back‑pressure가 형성된다. 이를 통해 consumer가 처리 가능한 속도 이상으로 메시지를 읽어오지 않게 된다. 실제 사례에서도 색인 동시성을 32에서 1로 줄이자 클러스터 CPU와 검색 지연이 크게 줄었다【901591924758741†L125-L143】.

#### 다중 작업자(Workers) 사용과 429 대응

Elastic Docs는 단일 스레드가 bulk 요청을 보내서는 클러스터 자원을 모두 활용할 수 없다고 설명한다【389495691530842†L924-L931】. 따라서 여러 스레드나 프로세스를 사용해 동시적으로 bulk 요청을 보내면 I/O 비용을 나누고 전체 처리량을 높일 수 있다. 그러나 너무 많은 병렬 작업자는 클러스터의 메모리와 CPU를 고갈시켜 `TOO_MANY_REQUESTS (429)` 오류를 초래할 수 있다【389495691530842†L932-L941】. 권장 사항은 다음과 같다:

* **복수 작업자/스레드 사용**: 한 스레드만으로는 클러스터를 포화시키기 어렵다. 여러 작업자를 통해 병렬로 bulk 요청을 전송해 전체 throughput을 높인다【389495691530842†L924-L931】.
* **적정 동시성 찾기**: 적정한 작업자 수는 환경마다 다르므로 실험적으로 찾아야 한다. 한 번에 작업자 수를 조금씩 늘리면서 CPU나 디스크 I/O가 포화되는 지점을 확인한다【389495691530842†L943-L945】.
* **429 오류 감지와 백오프**: 클러스터가 과부하되면 `EsRejectedExecutionException`을 통해 429 코드를 반환한다【389495691530842†L937-L941】. 이때는 indexer가 잠시 대기 후 재시도하는 지수 백오프 로직을 적용해야 한다【389495691530842†L937-L941】. 앞서 언급한 Medium 기사에서도 429 오류가 발생할 때는 임의의 지연으로 확장 지수 백오프를 쓰라고 권장한다【85091753486274†L118-L129】.

이러한 지침을 따라 `MAX_PARALLEL_FLUSHES`와 Kafka consumer 인스턴스 수를 조정하면 클러스터 리소스를 적절히 활용할 수 있다. 너무 적으면 쓰기 throughput이 낮아지고, 너무 많으면 429 오류와 지연이 발생한다. 따라서 모니터링 도구를 활용해 적절한 지점을 찾아야 한다.

## Elasticsearch 설정 가이드

Bulk 인덱싱 성능은 클라이언트 설계뿐 아니라 Elasticsearch 클러스터 설정에도 크게 좌우된다.

### Bulk API와 배치 크기

- Elastic 문서는 bulk 요청에 정답이 되는 문서 수가 없으며, 시스템 환경에 맞는 최적값을 찾아야 한다고 설명한다【102369654029175†L753-L755】. 요청의 크기는 100 MB 이하로 제한되어야 한다【102369654029175†L753-L757】.
- Elastic 커뮤니티의 조언에 따르면, 1 MB~10 MB 또는 500 ~ 1000개의 문서를 한 배치로 보내는 것이 일반적이다【750595237790637†L52-L61】. 너무 큰 배치(수십 MB 이상)는 GC와 heap 부하를 유발하고, 너무 작은 배치는 네트워크 왕복이 많아진다.

### Refresh interval 조정

- 색인된 문서를 검색에서 볼 수 있도록 만드는 **refresh** 작업은 비용이 크며, 지나치게 자주 호출하면 색인 속도가 저하된다. Elastic Docs는 대용량 bulk 작업을 수행할 때 `index.refresh_interval`을 `-1`로 설정하여 refresh를 비활성화한 뒤, 작업 완료 후 다시 원하는 값으로 설정할 것을 권장한다【389495691530842†L947-L986】. refresh를 비활성화하면 색인 중에는 문서가 검색되지 않지만, 로그 파이프라인은 약간의 지연을 허용하므로 적합하다.
- 기본값(1 초 refresh)은 색인량이 적고 검색량이 적을 때 최적이지만, 정기적인 검색 요청이 있는 경우 refresh interval을 30 초로 늘리면 색인 성능이 개선될 수 있다【389495691530842†L953-L966】.

### Replica 비활성화

- 대량 초기 적재 시 `index.number_of_replicas`를 0으로 설정하여 색인 성능을 높일 수 있다. Elastic Docs는 초기 로드를 빠르게 끝낸 뒤 다시 원래 값으로 되돌릴 것을 권장한다【389495691530842†L1011-L1018】. 다만 replica를 0으로 설정하면 노드 장애 시 데이터 손실 위험이 있으므로 외부 저장소나 Kafka에 데이터가 안전하게 남아있어야 한다.

### 기타 튜닝 사항

- **index buffer size**와 **translog flush threshold**: 노드가 heavy indexing만 수행한다면 `indices.memory.index_buffer_size`를 충분히 크게(예: 최소 512 MB / shard) 설정하여 버퍼가 너무 자주 flush되지 않도록 한다【85091753486274†L241-L266】. translog의 `flush_threshold_size`를 늘려서 디스크 flush 빈도를 줄이면 성능이 향상될 수 있다【85091753486274†L241-L266】.
- **Auto‑generated IDs**: 자체 아이디를 지정하면 Elasticsearch가 기존 문서를 조회하여 중복 여부를 확인해야 하므로 느려질 수 있다. Elastic Docs는 auto‑generated id를 사용할 때 색인 성능이 향상된다고 설명한다【389495691530842†L1054-L1060】. 하지만 로그 데이터는 추적을 위해 trace id나 timestamp를 key로 사용할 수도 있으며, 이 경우 id 조회 비용을 감수하거나 idempotent 파이프라인을 설계해야 한다.
- **Refresh interval과 replica 변경 이후 복구**: bulk 적재가 끝나면 refresh interval을 원래 값으로, replica를 원래 개수로 되돌린 뒤 필요하다면 `_forcemerge`를 수행하여 검색 성능을 최적화한다【389495691530842†L947-L1003】.

## Node / NestJS 구현 지침

### BulkIndexer 서비스 인터페이스

```ts
interface OffsetInfo {
  topic: string;
  partition: number;
  offset: string;
}

interface BulkIndexer {
  enqueue(document: LogDocument, offsetInfo: OffsetInfo): Promise<void>;
  flush(): Promise<void>;
}
```

BulkIndexer를 NestJS의 provider로 등록하여 전체 프로세스에서 하나의 인스턴스를 사용한다. `enqueue()`는 위에서 설명한 버퍼 로직을 구현하고, `flush()`는 현재 버퍼를 `_bulk` API로 전송한다. flush는 `MAX_PARALLEL_FLUSHES`를 넘지 않는 범위에서 실행된다.

### 서비스 연동 예시 흐름

1. **컨슈머** (`handleLogEvent`): DTO 파싱, 검증 후 `logIngestService.ingest(dto)`를 호출한다.
2. **logIngestService**: DTO를 Elasticsearch 문서로 변환하고 `bulkIndexer.enqueue(document, offsetInfo)`를 호출한다. 반환되는 `Promise`를 `await`하여 색인 완료를 기다린다.
3. **BulkIndexer**: 내부 버퍼에 데이터와 offset을 저장하고 플러시 조건을 점검한다.
4. **Kafka consumer config**: `eachMessage`/`handleLogEvent`에서 발생한 예외는 NestJS Kafka가 재시도를 처리하게 한다. `autoCommit: false` 또는 기본 자동 커밋 설정과 함께 at‑least‑once를 유지할 수 있도록 NestJS handler 패턴을 그대로 사용한다.

### 제한된 동시성 구현

`MAX_PARALLEL_FLUSHES` 값을 통해 몇 개의 bulk 요청을 동시에 처리할지 제어한다. 예를 들어 1로 두면 항상 하나씩 flush하고, 2 이상으로 올리면 Elastic 클러스터의 thread pool과 대기열이 허용하는 범위까지 동시 요청을 늘린다. 실험을 통해 적정 값을 찾아야 한다. Elastic 커뮤니티에서는 먼저 1 MB batch / 1 thread, 다음 2 MB / 1 thread, 다음 2 MB / 2 threads 등으로 조합을 실험해 보고 throughput이 떨어지는 지점을 찾으라고 조언한다【750595237790637†L52-L61】.

### 배치 크기 추정

Batch size를 문서 개수와 바이트 수 기준으로 동시에 제어하는 것이 이상적이다. 각 문서의 JSON 문자열 길이(또는 Buffer 길이)를 측정하여 누적 크기를 추적하고, 5 MB ~ 10 MB를 넘지 않도록 flush한다. Jörg Prante는 64 MB bulk가 너무 크며 GC 지연을 유발할 수 있다고 지적했다【750595237790637†L52-L61】.

### 에러·재시도 정책

Elasticsearch `_bulk` API는 응답에 `items` 배열을 포함하여 각 작업의 성공/실패 여부를 알려준다. 단순한 첫 구현에서는 **하나의 문서라도 실패하면 전체 배치 실패**로 처리하여 메시지를 재수신하도록 한다. 향후에는 부분 실패 문서만 재시도하는 로직을 추가하거나 Kafka DLQ(Dead Letter Queue)를 도입할 수 있다. 클러스터가 과부하되어 `429 Too Many Requests`가 발생하는 경우에는 bulkIndexer가 **지수 백오프**를 적용하여 재시도할 수 있다【85091753486274†L118-L129】.

### DTO 검증 최적화

대량 ingest 시 class‑validator 기반 DTO 검증이 병목이 될 수 있다. 필수 필드만 간단히 체크하여 검증 속도를 높이고, 복잡한 검증은 API 단이나 별도의 경로에서 수행하는 것이 좋다. 적재 모드에서는 debug 로그를 문서마다 찍지 말고 일정 건수마다 집계 로그를 찍어 I/O 오버헤드를 줄인다.

### 멀티 파티션·병렬 컨슈머

Kafka topic의 파티션 수를 늘리고 동일한 consumer group으로 여러 인스턴스를 실행하면 파티션 단위로 workload가 분산된다. BulkIndexer는 프로세스 내부에서만 상태를 공유하므로 각 컨슈머 인스턴스에 하나씩 생성된다. 클러스터 전체를 고려할 때, BulkIndexer의 동시 flush 수(`MAX_PARALLEL_FLUSHES`) 곱하기 인스턴스 수가 Elasticsearch cluster의 쓰기 스레드 풀을 넘지 않도록 주의한다. 클러스터가 429 에러를 반환하면 consumer 인스턴스 수 또는 flush 동시성을 줄이고, 지수 백오프를 도입하여 쓰기 속도를 조절한다.

## 벤치마킹과 튜닝

### 초기 파라미터 제안

| 파라미터 | 초기값 | 설명 |
|---|---|---|
| `BATCH_SIZE` | 500 ~ 1000 | 한 batch당 문서 수. 작은 값은 네트워크 오버헤드가 크고, 너무 큰 값은 ES heap/GC에 부담을 준다【750595237790637†L52-L61】. |
| `BATCH_BYTE_LIMIT` | 5 MB | 문서 크기를 합산하여 5 MB를 넘기 전에 flush. Elastic 커뮤니티에서 1 MB ~ 10 MB 사이를 권장함【750595237790637†L52-L61】. |
| `FLUSH_INTERVAL_MS` | 1000 ms | 문서가 적게 들어오는 상황에서 1 초마다 flush하여 지연을 줄인다. |
| `MAX_PARALLEL_FLUSHES` | 1 | 한 번에 하나의 bulk 요청을 수행하여 클러스터 과부하를 방지하고 관찰하기 쉽게 한다. 필요시 2 ~ 4까지 늘려 실험한다【901591924758741†L125-L143】. |

### 튜닝 방법

1. **배치 크기 조정**: 모니터링 도구(Kibana, Elastic APM 등)를 통해 bulk 요청의 처리 시간(`took`), 성공률, CPU 사용량을 관찰한다. 1 MB batch / 1 thread부터 시작해서 조금씩 크기나 동시성을 늘린 뒤 throughput이 떨어지는 지점을 찾는다【750595237790637†L52-L61】.
2. **Refresh interval/replica 변경**: 대량 적재를 진행하기 직전 해당 인덱스의 `refresh_interval`을 `-1`로 변경하고, `number_of_replicas`를 0으로 변경한다. 적재가 끝나면 원래 값으로 복구하고 필요 시 force merge를 수행한다【389495691530842†L947-L1003】.
3. **동시성 조정**: bulk flush의 동시에 실행되는 개수를 늘리면 throughput이 증가할 수 있으나, `429 Too Many Requests`가 나타나거나 검색 지연이 급증하면 값을 줄여야 한다. People.ai 사례에서는 동시 프로세스를 32에서 1로 줄여 클러스터 부하가 줄었다【901591924758741†L125-L143】. 용량이 충분한 클러스터에서는 2 ~ 4까지 늘려볼 수 있다.
4. **지수 백오프**: flush가 실패하거나 `429`를 받으면 1 초, 2 초, 4 초 등 점점 길게 대기한 뒤 재시도하여 클러스터에 과도한 부하를 주지 않도록 한다【85091753486274†L118-L129】.
5. **문서 설계 최적화**: 불필요하게 큰 문서나 깊은 중첩을 피하고, 필요하지 않은 필드는 매핑에서 제외한다. Search Guard 블로그에서도 인덱싱 성능을 높이려면 불필요한 필드를 줄이고 문서 크기를 최소화해야 한다고 권고한다【71945213822368†L100-L110】.

## 추가 고려 사항

### 인덱스 롤오버 및 시간 기반 설계

로그와 APM 데이터는 시간이 지남에 따라 방대해지므로 **데이터스트림 + ILM(인덱스 라이프사이클 관리)**를 사용하여 새로운 세그먼트를 주기적으로 롤오버하고 오래된 세그먼트를 삭제하는 것이 좋다. 롤오버 간격(예: 하루, 10GB 등)을 정의하여 각 데이터스트림이 적당한 크기를 유지하도록 한다. 이는 클러스터의 merge 부하를 줄이고 검색 성능을 안정적으로 유지한다.

### 롤업/집계 파이프라인 분리

1분 단위 버킷 카운트 같은 집계 작업은 ingest 경로에서 수행하지 말고, 별도의 후처리 파이프라인(ES Transform, Aggregation API + cron job, Redis 카운터 등)으로 분리하여 색인 성능에 영향을 주지 않도록 한다. 같은 컨슈머 경로에서 집계까지 수행하면 per-message 처리 시간이 길어져 throughput을 크게 떨어뜨린다.

### 하드웨어 및 운영 환경

- SSD 디스크 사용, 충분한 RAM, 그리고 Elasticsearch heap 사이즈를 전체 메모리의 50% 이하로 설정해 filesystem cache를 활용하는 것이 좋다【71945213822368†L66-L72】. 또한 swap을 비활성화하고 JVM heap 사이즈를 적절히 설정해야 한다【389495691530842†L1024-L1037】.
- Translog 크기(`flush_threshold_size`)와 인덱싱 버퍼를 조절해 flush/merge 빈도를 줄이면 성능이 향상될 수 있다【85091753486274†L241-L266】.
- Node 애플리케이션에서 CPU 집약적인 로직(class-validator, JSON 변환 등)을 줄이고, 로그 출력을 최소화해 I/O 부하를 줄인다.

## 결론

Bulk API와 제한된 동시성 전략을 통해 APM 로그 파이프라인의 색인 속도를 **수십 배 이상** 향상시킬 수 있다. 핵심은 메시지를 메모리 버퍼에 모았다가 일정 크기·시간마다 `_bulk` 요청으로 묶어 보내는 **BulkIndexer**를 도입하고, 동시에 플러시되는 요청 수를 제어하여 Elasticsearch 클러스터를 과부하하지 않는 것이다. Elastic 문서는 적절한 배치 크기와 refresh interval 조정을 통해 색인 성능을 최적화할 수 있다고 강조한다【389495691530842†L947-L986】, 【102369654029175†L753-L757】. 커뮤니티 경험도 1 MB~10 MB 정도의 청크와 실험을 통한 sweet spot 찾기를 권장하며, replica를 0으로 두고 refresh를 비활성화하면 초기 적재 속도를 크게 높일 수 있다고 말한다【750595237790637†L52-L61】. 이러한 설계를 코드화하면 단건 `index()` 기반 구조를 리팩터링하여 수십만 건의 로그도 수 분 이내에 색인할 수 있을 것이다.