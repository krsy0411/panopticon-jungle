# Kafka + BulkIndexer 병목 원인 분석 및 리팩토링 명세

본 문서는 **APM 로그 컨슈머에서 bulk 인덱싱으로 전환한 이후 성능이 기존 단건 index 대비 크게 떨어진 문제**의 원인을 정리하고,
그에 대한 **구체적인 코드 리팩토링 가이드**를 제공한다. 이 문서를 Codex에 넘겨서 자동으로 리팩토링할 수 있도록
**의도·배경·변경 포인트·코드 예시**를 모두 포함한다.

---

## 1. 현상 요약

- Kafka 토픽에 약 **100만 개 로그 메시지**가 적재되어 있음.
- 컨슈머 lag는 **100만 개 모두 소비 완료**로 표시됨.
- 하지만 **Elasticsearch 실제 인덱싱 속도는 분당 ~60건 수준**으로 매우 느림.
- bulk 도입 전, 각 메시지마다 `client.index()`로 단건 인덱싱할 때는 **분당 ~7,000건** 수준의 처리량이 나왔음.
- 즉, **bulk 인덱싱 도입 이후 소비는 잘 되는데 색인은 거의 안 되는 상황**.

이 문제는 Kafka 컨슈머 쪽의 **back-pressure 설계와 BulkIndexer의 Promise 사용 방식**이 겹치면서,
**“파티션당 1초에 1건” 수준으로 소비가 직렬화되어 버린 것**이 근본 원인이다.

---

## 2. 현재 처리 흐름 정리

### 2.1 Kafka → LogConsumerController

```ts
@EventPattern(process.env.KAFKA_APM_LOG_TOPIC ?? "apm.logs")
async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
  const value = context.getMessage().value;
  if (value == null) {
    this.logger.warn("Kafka 메시지에 본문이 없어 처리를 건너뜁니다.");
    return;
  }

  try {
    const dto = this.parsePayload(value);
    await this.logIngestService.ingest(dto);         // (1) 여기서 bulk enqueue를 await
    await this.errorLogForwarder.forward(dto);       // (2) 에러 로그 포워딩
    this.throughputTracker.markProcessed();
    ...
  } catch (error) {
    ...
    throw error;
  }
}
```

핵심 포인트: `handleLogEvent`는 **`logIngestService.ingest()`를 await** 한다.

---

### 2.2 LogIngestService (Kafka DTO → ES 문서)

```ts
@Injectable()
export class LogIngestService {
  private static readonly STREAM_KEY: LogStreamKey = "apmLogs";

  constructor(private readonly bulkIndexer: BulkIndexerService) {}

  async ingest(dto: LogEventDto): Promise<void> {
    const document: LogDocument = {
      "@timestamp": this.resolveTimestamp(dto.timestamp),
      type: "log",
      service_name: dto.service_name,
      environment: dto.environment,
      trace_id: dto.trace_id,
      span_id: dto.span_id,
      level: dto.level,
      message: dto.message,
      http_method: dto.http_method,
      http_path: dto.http_path,
      http_status_code: dto.http_status_code,
      labels: this.normalizeLabels(dto.labels),
      ingestedAt: new Date().toISOString(),
    };

    // 로그 문서를 bulk 버퍼에 적재하고 flush가 끝날 때까지 기다린다.
    await this.bulkIndexer.enqueue(LogIngestService.STREAM_KEY, document);
  }
}
```

핵심 포인트: `ingest()`는 **BulkIndexerService.enqueue()가 resolve될 때까지 기다리는 async 함수**이다.

---

### 2.3 BulkIndexerService (버퍼 → ES `_bulk`)

```ts
interface BufferedItem {
  index: string;
  document: BaseApmDocument;
  size: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

enqueue(streamKey: LogStreamKey, document: BaseApmDocument): Promise<void> {
  const indexName = this.storage.getDataStream(streamKey);
  const size =
    Buffer.byteLength(JSON.stringify({ index: { _index: indexName } })) +
    Buffer.byteLength(JSON.stringify(document)) +
    2;

  return new Promise<void>((resolve, reject) => {
    this.buffer.push({ index: indexName, document, size, resolve, reject });
    this.bufferedBytes += size;
    if (this.shouldFlushBySize()) {
      this.triggerFlush();
    } else {
      this.ensureFlushTimer();
    }
  });
}
```

`enqueue()`는 **해당 문서가 포함된 bulk flush가 끝났을 때 resolve되는 Promise**를 반환한다.

```ts
private async executeFlush(batch: BufferedItem[]): Promise<void> {
  const operations = this.buildOperations(batch);
  try {
    const response = await this.client.bulk({ operations });
    if (response.errors) {
      this.logBulkError(response);
      const error = new Error("Bulk 색인 중 일부 문서가 실패했습니다.");
      batch.forEach((item) => item.reject(error));
      return;
    }
    batch.forEach((item) => item.resolve());
    this.logger.debug(
      `Bulk 색인 완료 batch=${batch.length} took=${response.took ?? 0}ms`,
    );
  } catch (error) {
    const wrapped =
      error instanceof Error
        ? error
        : new Error(`Bulk 색인 실패: ${String(error)}`);
    batch.forEach((item) => item.reject(wrapped));
    this.logger.warn(
      "Bulk 색인 요청이 실패했습니다. Kafka 컨슈머가 재시도합니다.",
      wrapped.stack,
    );
  }
}
```

핵심 포인트: **flush 결과에 따라 batch 내 모든 Promise를 resolve/reject** 한다.

---

## 3. 근본 원인: Kafka 파티션 단위 직렬 처리 + bulk Promise 연동

### 3.1 Kafka eachMessage / NestJS EventPattern의 기본 동작

- NestJS Kafka 마이크로서비스는 내부적으로 `kafkajs`의 `eachMessage` 패턴을 사용한다.
- `eachMessage`는 **같은 파티션에 대해서는 한 번에 하나의 메시지 handler만 실행**한다.
- 즉, `handleLogEvent()`가 반환되기 전까지 **같은 파티션에서 다음 메시지를 넘겨주지 않는다.**

### 3.2 현재 구조에서 실제로 일어나는 일

1. 파티션 P0에 메시지 M1이 들어온다.
2. NestJS가 `handleLogEvent(M1)`을 호출한다.
3. `handleLogEvent()` 내부에서:
   - `parsePayload()`로 DTO로 변환.
   - `await this.logIngestService.ingest(dto);` 호출.
4. `logIngestService.ingest()`에서:
   - `await this.bulkIndexer.enqueue(...);` 호출.
5. `BulkIndexer.enqueue()`는:
   - `buffer.push(M1)` 한 뒤,
   - **해당 문서를 포함하는 bulk flush가 끝날 때까지 resolve되지 않는 Promise를 반환**.
6. `enqueue()`의 Promise가 resolve될 때까지:
   - `ingest()`는 반환하지 않음.
   - `handleLogEvent()`도 반환하지 않음.
   - 따라서 **kafkajs는 P0 파티션의 다음 메시지(M2)를 handler에 넘기지 않는다.**

### 3.3 버퍼 / 타이머와의 상호작용

- 기본 설정 (예시):
  - `BULK_BATCH_SIZE = 1000`
  - `BULK_FLUSH_INTERVAL_MS = 1000` (1초)
- 하지만 **동시에 여러 메시지를 소비하지 못하기 때문에** 버퍼에는 항상 “현재 처리 중인 메시지 1개 정도만” 들어온다.
- `shouldFlushBySize()` 조건은 거의 만족되지 않고,
  - 타이머(`flushIntervalMs`)가 1초마다 bulk flush를 수행한다.
- 결과적으로:
  - **파티션당 1초에 1개씩 bulk flush가 수행**된다.
  - 각 flush에는 보통 1개 문서만 포함된다.
  - => **파티션당 대략 초당 1건, 분당 60건 수준의 처리량**으로 떨어진다.
- 반대로, 단건 index일 때는:
  - 각 메시지에서 `client.index()` 하나만 await → 대략 수 ms~수십 ms 내에 반환.
  - 따라서 파티션당 초당 수십~수백 건을 처리할 수 있었다.

즉, **“bulk flush가 끝날 때까지 Kafka 컨슈머가 block되는 구조”** 때문에,
bulk가 이득을 못 보고 **극단적인 under-utilization**을 만드는 것이 문제의 핵심이다.

---

## 4. 리팩토링 목표

1. **Kafka 컨슈머는 bulk flush 완료까지 block되지 않고** 가능한 한 빨리 메시지를 소비한다.
   - 메시지 소비 속도 = Kafka → 메모리 버퍼 적재 속도.
2. **BulkIndexer는 별도의 비동기 작업으로 버퍼를 묶어서 ES `_bulk` 호출**을 수행한다.
3. MVP 단계에서는:
   - **엄격한 “flush 성공 후에만 offset commit”** 대신,
   - **최소한의 코드 변경으로 throughput을 회복하는 전략**을 사용한다.
   - 즉, flush 실패 시 Kafka에서 재처리하기보다는 **로그를 남기고 버리는(best-effort)** 쪽에 가깝다.
   - 추후 필요하면 `eachBatch + manual commit` 패턴으로 고도화할 수 있다.

---

## 5. 설계 변경안 (MVP 버전)

### 5.1 BulkIndexerService.enqueue를 *non-blocking*으로 변경

#### 5.1.1 BufferedItem 타입 단순화

**변경 전**

```ts
interface BufferedItem {
  index: string;
  document: BaseApmDocument;
  size: number;
  resolve: () => void;
  reject: (error: Error) => void;
}
```

**변경 후**

```ts
interface BufferedItem {
  index: string;
  document: BaseApmDocument;
  size: number;
}
```

- 더 이상 각 문서마다 개별 Promise를 resolve/reject하지 않는다.
- Bulk flush는 **“fire-and-forget 배치 작업”**으로 취급한다.

#### 5.1.2 enqueue() 시그니처 및 동작 변경

**변경 전**

```ts
enqueue(streamKey: LogStreamKey, document: BaseApmDocument): Promise<void> {
  const indexName = this.storage.getDataStream(streamKey);
  const size =
    Buffer.byteLength(JSON.stringify({ index: { _index: indexName } })) +
    Buffer.byteLength(JSON.stringify(document)) +
    2;

  return new Promise<void>((resolve, reject) => {
    this.buffer.push({ index: indexName, document, size, resolve, reject });
    this.bufferedBytes += size;
    if (this.shouldFlushBySize()) {
      this.triggerFlush();
    } else {
      this.ensureFlushTimer();
    }
  });
}
```

**변경 후 (핵심 아이디어)**

```ts
enqueue(streamKey: LogStreamKey, document: BaseApmDocument): void {
  const indexName = this.storage.getDataStream(streamKey);
  const size =
    Buffer.byteLength(JSON.stringify({ index: { _index: indexName } })) +
    Buffer.byteLength(JSON.stringify(document)) +
    2;

  // 즉시 버퍼에 쌓고 반환한다. (Promise 없음)
  this.buffer.push({ index: indexName, document, size });
  this.bufferedBytes += size;

  if (this.shouldFlushBySize()) {
    this.triggerFlush();
  } else {
    this.ensureFlushTimer();
  }
}
```

- `enqueue()`는 더 이상 `Promise`를 반환하지 않는다.
- 호출자는 **flush 완료 여부를 기다리지 않고 바로 다음 로직으로 진행**한다.
- Kafka 컨슈머 입장에서는 **메시지를 메모리 버퍼에 적재하는 순간 이미 “처리 완료”로 간주**하게 된다.

#### 5.1.3 executeFlush()에서 Promise 관련 코드 제거

**변경 전**

```ts
private async executeFlush(batch: BufferedItem[]): Promise<void> {
  const operations = this.buildOperations(batch);
  try {
    const response = await this.client.bulk({ operations });
    if (response.errors) {
      this.logBulkError(response);
      const error = new Error("Bulk 색인 중 일부 문서가 실패했습니다.");
      batch.forEach((item) => item.reject(error));
      return;
    }
    batch.forEach((item) => item.resolve());
    this.logger.debug(
      `Bulk 색인 완료 batch=${batch.length} took=${response.took ?? 0}ms`,
    );
  } catch (error) {
    const wrapped =
      error instanceof Error
        ? error
        : new Error(`Bulk 색인 실패: ${String(error)}`);
    batch.forEach((item) => item.reject(wrapped));
    this.logger.warn(
      "Bulk 색인 요청이 실패했습니다. Kafka 컨슈머가 재시도합니다.",
      wrapped.stack,
    );
  }
}
```

**변경 후 (MVP용 단순 버전)**

```ts
private async executeFlush(batch: BufferedItem[]): Promise<void> {
  const operations = this.buildOperations(batch);
  try {
    const response = await this.client.bulk({ operations });

    if (response.errors) {
      // 일부 문서 실패 → 상세 에러 로그만 남기고, Kafka 재처리는 하지 않는다.
      this.logBulkError(response);
      this.logger.warn(
        `Bulk 색인 중 일부 문서가 실패했습니다. batch=${batch.length} took=${response.took ?? 0}ms`,
      );
    } else {
      this.logger.debug(
        `Bulk 색인 완료 batch=${batch.length} took=${response.took ?? 0}ms`,
      );
    }
  } catch (error) {
    const wrapped =
      error instanceof Error
        ? error
        : new Error(`Bulk 색인 실패: ${String(error)}`);

    this.logger.warn(
      "Bulk 색인 요청이 실패했습니다. Kafka 컨슈머는 메시지를 계속 처리합니다.",
      wrapped.stack,
    );
  }
}
```

- flush 실패 시 **Kafka 쪽으로 예외를 전달하지 않는다.**
- 대신 **실패 로그만 남기고 다음 batch로 넘어가는 구조**이다.
- 이로 인해 “ES 인덱싱 실패 시 동일 메시지를 Kafka에서 재처리하는” 기능은 사라지지만,
  **현재 문제(throughput 급락)를 해결하는 것이 우선**인 MVP 단계에서는 합리적인 트레이드오프다.

> 이후 고도화 단계에서, `eachBatch + manual commit` 구조를 도입해
> flush 성공 여부에 따라 offset commit을 조절하는 전략으로 개선할 수 있다.

---

### 5.2 LogIngestService.ingest를 sync 스타일로 변경

`BulkIndexerService.enqueue()`가 이제 `void`를 반환하므로,
`LogIngestService.ingest()`도 더 이상 async/await가 필요 없다.

**변경 전**

```ts
@Injectable()
export class LogIngestService {
  private static readonly STREAM_KEY: LogStreamKey = "apmLogs";

  constructor(private readonly bulkIndexer: BulkIndexerService) {}

  async ingest(dto: LogEventDto): Promise<void> {
    const document: LogDocument = {
      "@timestamp": this.resolveTimestamp(dto.timestamp),
      type: "log",
      service_name: dto.service_name,
      environment: dto.environment,
      trace_id: dto.trace_id,
      span_id: dto.span_id,
      level: dto.level,
      message: dto.message,
      http_method: dto.http_method,
      http_path: dto.http_path,
      http_status_code: dto.http_status_code,
      labels: this.normalizeLabels(dto.labels),
      ingestedAt: new Date().toISOString(),
    };

    await this.bulkIndexer.enqueue(LogIngestService.STREAM_KEY, document);
  }
}
```

**변경 후**

```ts
@Injectable()
export class LogIngestService {
  private static readonly STREAM_KEY: LogStreamKey = "apmLogs";

  constructor(private readonly bulkIndexer: BulkIndexerService) {}

  ingest(dto: LogEventDto): void {
    const document: LogDocument = {
      "@timestamp": this.resolveTimestamp(dto.timestamp),
      type: "log",
      service_name: dto.service_name,
      environment: dto.environment,
      trace_id: dto.trace_id,
      span_id: dto.span_id,
      level: dto.level,
      message: dto.message,
      http_method: dto.http_method,
      http_path: dto.http_path,
      http_status_code: dto.http_status_code,
      labels: this.normalizeLabels(dto.labels),
      ingestedAt: new Date().toISOString(),
    };

    // ES bulk 버퍼에만 적재하고, flush 완료는 기다리지 않는다.
    this.bulkIndexer.enqueue(LogIngestService.STREAM_KEY, document);
  }
}
```

- 반환 타입을 `Promise<void>` → `void`로 변경.
- 내부에서 `await` 제거.

---

### 5.3 LogConsumerController.handleLogEvent에서 ingest await 제거

**변경 전**

```ts
@EventPattern(process.env.KAFKA_APM_LOG_TOPIC ?? "apm.logs")
async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
  const value = context.getMessage().value;
  if (value == null) {
    this.logger.warn("Kafka 메시지에 본문이 없어 처리를 건너뜁니다.");
    return;
  }

  try {
    const dto = this.parsePayload(value);
    await this.logIngestService.ingest(dto);
    await this.errorLogForwarder.forward(dto);
    this.throughputTracker.markProcessed();
    this.logger.debug(
      `로그가 색인되었습니다. topic=${context.getTopic()} partition=${context.getPartition()}`,
    );
  } catch (error) {
    ...
    throw error;
  }
}
```

**변경 후**

```ts
@EventPattern(process.env.KAFKA_APM_LOG_TOPIC ?? "apm.logs")
async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
  const value = context.getMessage().value;
  if (value == null) {
    this.logger.warn("Kafka 메시지에 본문이 없어 처리를 건너뜁니다.");
    return;
  }

  try {
    const dto = this.parsePayload(value);

    // 1) ES bulk 버퍼에 비동기로만 적재하고, Kafka 소비는 block하지 않는다.
    this.logIngestService.ingest(dto);

    // 2) 에러 로그 포워딩은 기존과 같이 await (필요시 나중에 비동기로 바꿀 수 있음)
    await this.errorLogForwarder.forward(dto);

    this.throughputTracker.markProcessed();
    this.logger.debug(
      `로그 처리 완료: topic=${context.getTopic()} partition=${context.getPartition()}`,
    );
  } catch (error) {
    if (error instanceof InvalidLogEventError) {
      this.logger.warn(
        `유효하지 않은 로그 이벤트를 건너뜁니다: ${error.message}`,
      );
      return;
    }
    this.logger.error(
      "로그 이벤트 처리에 실패했습니다.",
      error instanceof Error ? error.stack : String(error),
    );
    throw error;
  }
}
```

- `logIngestService.ingest(dto)`에서 `await` 제거.
- ES bulk flush는 **백그라운드에서 진행**되고,
  Kafka 컨슈머는 빠르게 다음 메시지를 처리한다.
- 에러 로그 포워딩이 상대적으로 가벼운 작업이라면 굳이 비동기화하지 않아도
  **전체 throughput의 병목은 BulkIndexer 쪽에서 해소**된다.

> 필요시, `errorLogForwarder.forward(dto)`도 fire-and-forget으로 바꿀 수 있지만,
> 현재 병목의 주범은 bulk flush이므로 우선 priority는 낮다.

---

### 5.4 다른 모듈에서 BulkIndexerService 사용 시 점검

`BulkIndexerService`는 로그 외에 **스팬 등 다른 도메인에서도 재사용**될 수 있으므로,
코드베이스 전체에서 다음 패턴을 검색해 한 번에 수정해야 한다.

- 검색 키워드 예시:
  - `await this.bulkIndexer.enqueue(`
  - `await bulkIndexer.enqueue(`
- 각 사용처를 다음과 같이 변경:
  - `await bulkIndexer.enqueue(...);` → `bulkIndexer.enqueue(...);`
  - 해당 서비스 메서드의 반환 타입도 필요 시 `Promise<void>` → `void`로 변경.

---

## 6. 이 리팩토링으로 기대되는 효과

1. **Kafka 소비 속도 회복**
   - 컨슈머는 더 이상 bulk flush 완료를 기다리지 않으므로,
     **파티션당 초당 수천 건 수준까지** 다시 메시지를 소비할 수 있다
     (실제 값은 ES/네트워크 성능에 따라 달라짐).
   - 현재 관찰된 **분당 60건 수준의 throughput 문제는 사라지고**, 최소한
     bulk 도입 이전(분당 ~7,000건) 수준 이상으로 회복될 가능성이 매우 높다.

2. **bulk의 이점 유지**
   - ES 쪽에서는 여전히 **NDJSON `_bulk` API**를 사용하므로,
     단건 index 대비 **round-trip 횟수 감소 및 CPU/네트워크 효율 증가** 효과를 유지한다.
   - `maxBatchSize`, `maxBatchBytes`, `flushIntervalMs` 설정을 조절하여
     최적의 batch 크기를 찾을 수 있다.

3. **구현 복잡도 최소**
   - Kafka offset과 ES flush 간의 엄격한 트랜잭션 일관성은 포기하지만,
     그 대신 **코드 변경량은 작고, 논리도 단순**하다.
   - MVP 단계에서 현실적인 타협점이다.

---

## 7. 후속 고도화 아이디어 (필수 아님, 참고용)

> 이 섹션은 Codex가 당장 구현할 필요는 없고, 차후 개선 시 참고용이다.

1. **각 파티션별 in-flight 문서 수 제한**
   - 메모리 사용량을 제한하기 위해 `MAX_BUFFERED_ITEMS` 같은 옵션을 두고,
     일정 개수 이상 쌓이면 `enqueue()`에서 잠시 block하는 전략 적용 가능.

2. **eachBatch + manual commit 패턴**
   - kafkajs의 `eachBatch`를 사용해:
     - 특정 배치(예: N개의 메시지)를 메모리 버퍼에 넣은 뒤,
     - 해당 배치에 대한 bulk flush가 성공하면 offset commit,
     - 실패하면 배치 전체 재처리 등의 로직 구현 가능.
   - 이 패턴은 **throughput + at-least-once 보장**을 모두 고려하는 고급 설계다.

3. **Dead Letter Queue(DLQ) 도입**
   - ES flush가 반복적으로 실패하는 문서는 Kafka DLQ 토픽으로 보내고,
     별도의 복구/분석 파이프라인에서 처리할 수 있다.

---

## 8. Codex를 위한 구현 체크리스트

Codex가 이 문서를 바탕으로 코드를 수정할 때 따라야 할 **구체적인 단계**는 다음과 같다.

1. **`bulk-indexer.service.ts` 수정**
   - `BufferedItem` 인터페이스에서 `resolve`, `reject` 제거.
   - `enqueue()`의 반환 타입을 `Promise<void>` → `void`로 변경하고,
     내부에서 `new Promise` 생성 로직 제거.
   - `executeFlush()`에서 `batch.forEach(item => item.resolve/reject)` 호출 제거.
   - 로그 메시지를 위 예시처럼 정리.

2. **`log-ingest.service.ts` 수정**
   - `ingest()`의 시그니처를 `async ingest(...): Promise<void>` → `ingest(...): void`로 변경.
   - 내부의 `await this.bulkIndexer.enqueue(...)`를 `this.bulkIndexer.enqueue(...)`로 변경.

3. **`log-consumer.controller.ts` 수정**
   - `handleLogEvent()` 내부에서 `await this.logIngestService.ingest(dto);` 를
     `this.logIngestService.ingest(dto);`로 변경.
   - 나머지 로직은 그대로 두되, 로그 메시지는 상황에 맞게 약간 수정 가능.

4. **BulkIndexerService 다른 사용처 점검**
   - 전체 코드베이스에서 `await bulkIndexer.enqueue` 패턴 검색.
   - 동일한 방식으로 `await` 제거 및 함수 시그니처 조정.

5. **빌드 및 테스트**
   - TypeScript 컴파일 오류가 없는지 확인.
   - 로컬 환경에서 Kafka → ES 파이프라인을 실행하고,
     - 컨슈머 lag가 빠르게 감소하는지,
     - ES에 초당 수천 건 수준으로 색인되는지 확인.
   - ES `_cat/indices` 또는 Kibana에서 로그 도큐먼트 수를 확인해 throughput을 체감.

이 체크리스트를 모두 수행하면, **현재 bulk 인덱싱으로 인해 발생한 극단적인 성능 저하 문제는 해결**되고,
MVP에 적합한 수준의 고성능 로그 파이프라인을 확보할 수 있다.
