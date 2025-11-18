# APM 로그 Kafka 소비에서 bulk 인덱싱 성능 문제 분석 및 개선 방안

## 문제 상황 요약

- 배포 환경에서 APM 로그를 Kafka → Elasticsearch로 이전하는 도중 **bulk index** 모드로 리팩터링하였다. 기존의 단건 `index()` 방식에서는 1분에 약 7 000개 문서가 Elasticsearch에 색인되었지만, bulk index로 전환한 뒤에는 Kafka 토픽에 **100만건**의 로그가 쌓여 있음에도 불구하고 Elasticsearch 색인이 1분에 **약 60건** 수준으로 급격히 감소하였다. 
- Kafka consumer의 lag는 모두 소비한 것으로 나타나지만, Elasticsearch에는 거의 데이터가 들어오지 않는다. 이는 Kafka에서 메시지를 빠르게 가져왔지만, 어딘가에서 블로킹이 발생해 메시지 처리가 지연되고 있다는 의미다.

## 원인 분석

### 1. `handleLogEvent`가 bulk flush 완료까지 블록(block)한다

현재의 `LogConsumerController.handleLogEvent()`는 Kafka 메시지를 DTO로 변환한 뒤 `logIngestService.ingest(dto)`를 **`await`** 하고, 그 다음 `errorLogForwarder.forward(dto)`를 `await`한다. `LogIngestService.ingest()`는 내부적으로 `bulkIndexer.enqueue()`를 호출한다. 

`BulkIndexerService.enqueue()`는 문서를 메모리 버퍼에 추가하고, 버퍼가 일정 크기(`BULK_BATCH_SIZE`, 기본값 1000개)나 크기(`BULK_BATCH_BYTES_MB`)를 넘어서거나 플러시 간격(`BULK_FLUSH_INTERVAL_MS`, 기본 1 s)이 만료될 때만 `_bulk` API를 호출한다. 중요 포인트는 `enqueue()`가 **`Promise`를 반환하며, flush가 완료된 뒤에야 `resolve()`** 된다는 점이다. `ingest()`는 이 Promise를 그대로 `await` 하므로 **해당 문서가 포함된 bulk flush가 끝날 때까지 consumer가 멈춘다**.

KafkaJS의 `eachMessage` API는 기본적으로 같은 파티션에서는 다음 메시지를 호출하지 않고 **이전 메시지 처리가 끝날 때까지 순차적으로(block) 처리한다**. KafkaJS 공식 문서는 `eachMessage` 핸들러가 세션 타임아웃보다 오래 블록되어서는 안 된다고 명시한다【880035443235562†L100-L107】. 또한 기본적으로 `eachMessage`는 각 파티션에 대해 순차 호출되며, 여러 메시지를 동시에 처리하려면 `partitionsConsumedConcurrently` 옵션을 설정해야 한다【880035443235562†L205-L223】. 

따라서 현재 구조는 다음과 같이 동작한다:

1. KafkaJS가 특정 파티션에서 메시지를 하나 전달한다. `handleLogEvent()`는 `bulkIndexer.enqueue()`가 포함된 `ingest()`를 `await` 한다.
2. `enqueue()`는 버퍼가 가득 찼거나 타이머가 만료될 때까지(최대 1 s) 반환되지 않으므로, `handleLogEvent()`는 최대 1초 동안 멈춘다.
3. KafkaJS는 같은 파티션에 대해 다음 메시지를 전달하지 않기 때문에, **버퍼가 1 000개가 차기 전까지(또는 1초가 지난 후)** consumer는 새로운 메시지를 가져오지 못한다. 
4. 결국 1 000개를 모으기 전에 flush 타이머가 만료되고, 1 초마다 1건만 flush되는 현상이 발생한다. 이 구조는 생산자(back‑pressure)를 고려해 설계된 것이나, 파티션당 직렬 처리와 겹쳐지면서 throughput을 수십건/분 수준으로 떨어뜨렸다.

### 2. 동시성 부족과 작업 단위가 큼

- `eachMessage`는 같은 파티션에 대해 순차적으로 실행되므로, 네트워크 I/O나 _bulk_ API 같은 **비동기 작업이 긴 경우** 성능이 크게 떨어진다. KafkaJS 문서에 따르면 여러 파티션에서 메시지를 동시에 처리하려면 `partitionsConsumedConcurrently` 값을 늘려야 한다【880035443235562†L205-L223】.
- Elasticsearch 공식 가이드에서는 개별 문서 색인보다 bulk API를 사용하는 것이 성능에 유리하지만, **단일 스레드로 bulk 요청을 전송하면 Elasticsearch 클러스터의 자원을 충분히 활용하지 못한다**고 설명한다. 여러 스레드/프로세스로 동시에 bulk 요청을 보내는 것이 이상적이며, 요청 크기는 실험을 통해 찾되 너무 큰 요청은 오히려 메모리 압박을 줄 수 있다고 경고한다【676536220397772†L905-L931】.
- WWT의 KafkaJS 경험 보고서는 `eachMessage`를 이용하여 외부 API 호출을 하던 코드를 `eachBatch` + 배치 엔드포인트로 전환한 결과 **8–10배 성능 향상**을 얻었다고 언급한다【901272165489513†L281-L285】. 이는 단건 처리보다 배치 처리, 그리고 배치별 커밋이 성능에 큰 영향을 준다는 실증적인 사례다.

## 설계상의 문제점 정리

| 문제 | 증상/근거 |
|---|---|
| **await로 인해 Kafka consumer가 bulk flush까지 블로킹** | `enqueue()`의 Promise가 flush 완료 후에야 resolve돼 `handleLogEvent()`가 멈추고, KafkaJS는 같은 파티션의 다음 메시지를 호출하지 않는다. `eachMessage`는 블로킹 연산을 피해야 한다는 문서【880035443235562†L100-L107】. |
| **파티션당 직렬 처리** | 기본 설정에서는 `eachMessage`가 순차적으로 실행되어 네트워크 지연이 throughput을 제한한다. KafkaJS는 `partitionsConsumedConcurrently` 옵션으로 여러 메시지를 동시에 처리할 수 있음을 명시한다【880035443235562†L205-L223】. |
| **Bulk 요청 크기/타이머 설정이 부적합** | `maxBatchSize=1000`, `flushIntervalMs=1000`은 파티션당 초당 하나의 flush만 발생해 메시지가 버퍼에 오래 머무른다. Elastic 문서는 bulk 요청 크기와 워커 수를 실험적으로 맞추고 너무 크면 성능이 떨어질 수 있다고 설명한다【676536220397772†L905-L931】. |
| **단일 스레드에서만 bulk 호출** | Elastic 문서는 여러 스레드/프로세스로 bulk 요청을 보내야 클러스터 자원을 최대한 활용할 수 있다고 권장한다【676536220397772†L924-L946】. 현재 `BulkIndexerService`는 `maxParallelFlushes` 옵션을 제공하지만 기본값 2로 제한돼 있다. |

## 개선 방안

### 1. 비동기 처리 개선 – consumer를 flush 완료까지 기다리지 않기

메시지 소비는 빠르게 진행되고, bulk flush는 백그라운드에서 비동기로 처리되도록 설계하는 것이 중요하다. 따라서 `bulkIndexer.enqueue()`를 호출할 때 반환되는 `Promise`를 **기다리지 않고** Fire‑and‑forget 방식으로 큐에 추가해야 한다. 실패 시에는 로깅하고 메트릭을 올리거나 Kafka 오프셋 커밋을 별도로 관리해야 한다.

구체적으로:

- `LogIngestService.ingest()`에서 `await this.bulkIndexer.enqueue(...)`를 제거하고, 반환되는 Promise를 처리하지 않은 채로 버퍼에 넣는다. 에러는 `.catch()`에서 로깅한다. 이렇게 하면 Kafka consumer는 flush 타이밍과 무관하게 다음 메시지를 계속 받을 수 있다.
- `LogConsumerController.handleLogEvent()`에서도 `await`를 제거해 consumer 핸들러가 블로킹되지 않도록 한다. 에러 처리를 위해 반환된 Promise를 별도로 캐치하고 로깅하거나, 실패한 경우 해당 오프셋을 별도 큐에 저장해 재처리할 수 있다.

이 방법의 단점은 **오프셋 커밋 타이밍이 빨라질 수 있어 일부 문서가 Elasticsearch에 완전히 색인되기 전에 메시지를 성공으로 간주할 수 있다는 것**이다. 만약 정확한 처리 보장이 필요하다면, 아래의 `eachBatch` 패턴이나 manual commit을 활용해 flush 이후에만 커밋하도록 관리하는 방식을 채택한다.

### 2. 각 파티션 병렬 처리 – `partitionsConsumedConcurrently` 사용

KafkaJS는 기본적으로 파티션당 하나의 `eachMessage` 호출만 실행한다. 비동기 작업이 길어지면 전체 처리량이 급격히 떨어지므로, 여러 파티션을 동시에 처리하도록 `partitionsConsumedConcurrently`를 늘려야 한다. KafkaJS 문서에 따르면 `partitionsConsumedConcurrently` 값을 올리면 여러 파티션의 메시지를 동시에 처리하면서도 **같은 파티션 내 순서를 보장**한다【880035443235562†L205-L223】. NestJS에서는 microservice 옵션에 `consumer: { partitionsConsumedConcurrently: N }`를 지정하여 이를 설정할 수 있다. 

예를 들어, 토픽이 4개 파티션으로 구성돼 있고 CPU 코어가 충분하다면 `partitionsConsumedConcurrently: 2` 또는 `3`을 설정하여 파티션 간 병렬성을 올릴 수 있다. 이 값은 파티션 수보다 크게 설정해도 효과가 없으므로, 토픽의 파티션 수와 시스템 성능을 고려해 실험적으로 결정한다.

### 3. `eachBatch` 및 manual commit 패턴으로 전환

bulk 인덱싱은 본질적으로 여러 레코드를 하나의 요청으로 묶는 작업이므로, Kafka consumer에서도 **배치 단위로 메시지를 가져와 처리**하는 것이 더 적합하다. `eachBatch` 핸들러는 메시지 배열과 함께 `resolveOffset`/`commitOffsetsIfNecessary`/`heartbeat` 등 유용한 API를 제공한다【880035443235562†L109-L166】. 이를 이용하면 다음과 같은 장점이 있다:

- 한 배치의 메시지를 모두 `bulkIndexer.enqueue()`로 넣은 뒤 바로 flush를 요청할 수 있다.
- flush가 완료된 후 `commitOffsetsIfNecessary()`를 호출하여 해당 배치의 마지막 오프셋만 커밋함으로써 **at‑least‑once** 처리를 보장한다.
- `eachBatch`는 기본적으로 KafkaJS 내부에서 batch 당 자동 커밋을 수행하며, `eachBatchAutoResolve`를 제어하여 원하는 커밋 시점을 조정할 수 있다.

WWT의 사례에서도 `eachMessage` 대신 `eachBatch` 패턴을 사용하고 외부 API도 배치로 묶자 **8–10배 이상 성능 향상**을 경험했다고 보고한다【901272165489513†L281-L285】.

### 4. Bulk flush 파라미터 조정 및 병렬 flush 증가

- **배치 크기와 플러시 주기 조정** : 현재 `BULK_BATCH_SIZE=1000`, `BULK_FLUSH_INTERVAL_MS=1000`은 빈도가 너무 낮아 batch가 1000개가 채워지지 않는 상황에서 1초마다 하나의 flush만 발생한다. Elastic 문서에서는 최적의 bulk 크기를 실험적으로 찾고, 너무 큰 요청은 메모리 압박을 유발할 수 있으므로 수십 MB를 넘기지 않도록 권고한다【676536220397772†L905-L916】. 예를 들어 초기 배치 크기를 200–500개로 줄이고 flush 간격을 100–200 ms로 줄이면 메시지가 버퍼에 오래 머무르지 않고 빠르게 색인된다.
- **동시 flush 수 늘리기** : `BulkIndexerService`의 `maxParallelFlushes`는 동시 flush 요청 수를 제한한다. 현재 기본값은 2인데, Elasticsearch 클러스터 여유가 있다면 이 값을 늘려서 동시에 여러 bulk 요청을 보내도록 한다. Elastic 문서에서도 단일 스레드로는 클러스터의 색인 성능을 충분히 활용하지 못한다고 지적하며, 여러 워커/스레드를 통해 데이터를 전송해야 한다고 조언한다【676536220397772†L924-L931】.

## 코드 수정안 (예시)

아래 수정안은 기존 구조를 크게 바꾸지 않으면서 consumer 블로킹 문제를 해결하는 접근법이다. 정확한 구현은 서비스 요구 사항(정확한 처리 보장 vs. 처리량 우선)을 고려해 조정한다.

### 1. `LogIngestService.ingest()` – bulk enqueue를 Fire‑and‑forget으로 변경

```ts
// src/apm/log-ingest/log-ingest.service.ts
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

  // 버퍼에 적재한 뒤 기다리지 않는다. 실패 시에는 로깅만 하고, 필요하다면 재시도 로직을 별도로 구현한다.
  void this.bulkIndexer
    .enqueue(LogIngestService.STREAM_KEY, document)
    .catch((err) => {
      // handle error: 메트릭 증가, 모니터링, 재큐잉 등
      this.logger.error('Bulk enqueue failed', err);
    });
}
```

### 2. `LogConsumerController.handleLogEvent()` – 비동기 호출로 변경

```ts
// src/log-consumer/log-consumer.controller.ts
@EventPattern(process.env.KAFKA_APM_LOG_TOPIC ?? 'apm.logs')
async handleLogEvent(@Ctx() context: KafkaContext): Promise<void> {
  const value = context.getMessage().value;
  if (value == null) {
    this.logger.warn('Kafka 메시지에 본문이 없어 처리를 건너뜁니다.');
    return;
  }

  try {
    const dto = this.parsePayload(value);
    // bulk 인덱싱은 기다리지 않고 큐에 추가
    this.logIngestService.ingest(dto);
    // 에러 로그 포워딩은 빠르게 끝나므로 동시에 실행하도록 하되, 필요하다면 await
    void this.errorLogForwarder.forward(dto).catch((err) => {
      this.logger.error('Error forward failed', err);
    });
    // 처리된 메시지 카운트는 즉시 증가시킨다
    this.throughputTracker.markProcessed();
    this.logger.debug(
      `로그 이벤트 처리 시작: topic=${context.getTopic()} partition=${context.getPartition()}`,
    );
  } catch (error) {
    if (error instanceof InvalidLogEventError) {
      this.logger.warn(
        `유효하지 않은 로그 이벤트를 건너뜁니다: ${error.message}`,
      );
      return;
    }
    this.logger.error(
      '로그 이벤트 처리에 실패했습니다.',
      error instanceof Error ? error.stack : String(error),
    );
    // 오류를 throw하면 KafkaJS가 해당 오프셋을 커밋하지 않고 재처리한다.
    throw error;
  }
}
```

이렇게 수정하면 `handleLogEvent()`는 bulk flush 완료 여부와 무관하게 다음 메시지를 받을 수 있어 consumer가 블로킹되지 않는다. 단, flush 실패와 오프셋 커밋 사이의 정확한 처리 보증을 위해서는 manual commit을 적용하거나 실패한 문서를 별도 큐에 저장하는 전략이 필요하다.

### 3. Kafka consumer 동시성 설정

KafkaJS에서 파티션을 병렬로 처리하려면 consumer 실행 시 `partitionsConsumedConcurrently`를 설정한다. NestJS에서는 microservice 옵션에 다음과 같이 추가한다. 이 설정은 토픽의 파티션 수와 시스템 리소스를 고려해 조정한다.

```ts
// 예시: KafkaModule 등록 시 consumer 옵션에 partitionsConsumedConcurrently 설정
KafkaModule.register({
  client: {
    clientId: 'apm-log-consumer',
    brokers: [process.env.KAFKA_BROKER_URL],
  },
  consumer: {
    groupId: process.env.KAFKA_GROUP_ID ?? 'apm-log-group',
    // 파티션 3개를 동시에 소비. 값은 파티션 수보다 크지 않아야 함
    partitionsConsumedConcurrently: Number.parseInt(process.env.KAFKA_CONCURRENT_PARTITIONS ?? '2', 10),
  },
});
```

`ConsumerRunConfig` 타입 정의에는 `partitionsConsumedConcurrently` 옵션이 존재하며, `eachBatch`/`eachMessage`와 함께 사용할 수 있다【217620888615763†L2674-L2678】. 이 값을 증가시키면 여러 파티션에서 메시지를 동시에 처리하면서도 **각 파티션 내 순서는 유지**된다【880035443235562†L205-L223】.

### 4. `eachBatch` 패턴으로 전환 (선택적)

보다 강력한 처리량과 정확한 오프셋 관리가 필요하다면 `eachBatch`를 활용한 구조를 고려한다. 간략한 흐름은 다음과 같다:

1. Kafka consumer를 `autoCommit: false` 또는 `eachBatchAutoResolve: false`로 설정한다.
2. `eachBatch` 핸들러에서 `batch.messages` 배열을 순회하며 각 메시지를 DTO로 변환하고 `bulkIndexer.enqueue()`에 넣는다. 이 때 `enqueue()`는 기다리지 않고 바로 반환한다.
3. 배치의 모든 메시지가 큐에 들어가면 즉시 `bulkIndexer.triggerFlush()`(별도의 public API를 만들거나 `maxBatchSize`/`flushIntervalMs`를 낮춤)로 flush를 요청한다.
4. flush가 성공하면 `resolveOffset`으로 배치의 마지막 오프셋을 표시하고 `commitOffsetsIfNecessary()`를 호출해 해당 오프셋을 커밋한다. 실패하면 예외를 throw해 KafkaJS가 동일 배치를 재처리하게 한다.

이 방식은 메시지 처리와 flush를 분리하면서도 flush가 성공해야만 오프셋을 커밋하므로 **at‑least‑once** 보장에 적합하다. 구현 난이도가 높지만 성능 향상과 신뢰성을 동시에 얻을 수 있다.

### 5. Bulk flush 파라미터 조정

환경 변수나 설정 파일을 통해 다음 값을 조정한다:

- `BULK_BATCH_SIZE` – 한 번에 묶을 문서 수. 초기에는 100–500 사이로 설정해 메시지가 버퍼에 머무는 시간을 줄인다.
- `BULK_BATCH_BYTES_MB` – 배치의 최대 바이트 수. 너무 크면 Elasticsearch가 과부하될 수 있으므로 수십 MB 이하를 권장한다【676536220397772†L905-L916】.
- `BULK_FLUSH_INTERVAL_MS` – 타이머 기반 flush 주기. 실험적으로 100–200 ms로 줄이면 작은 배치라도 지연 없이 flush된다.
- `BULK_MAX_PARALLEL_FLUSHES` – 동시 flush 횟수. 클러스터가 견딜 수 있는 범위에서 값을 늘리면 여러 배치를 동시에 색인할 수 있다【676536220397772†L924-L931】.

## 결론

현재 문제는 bulk 인덱싱 자체가 아니라, **consumer가 flush 완료까지 블로킹**되는 설계와 **파티션당 직렬 처리**가 결합되면서 발생한 병목이다. KafkaJS 문서가 경고하듯 `eachMessage` 핸들러는 장시간 블로킹을 피해야 하며, 여러 파티션을 동시에 처리하도록 `partitionsConsumedConcurrently`를 설정해야 한다【880035443235562†L100-L107】【880035443235562†L205-L223】. 또한 Elasticsearch에서는 bulk 요청을 여러 스레드에서 보내야 최대 색인 속도를 달성할 수 있고, 배치 크기와 flush 주기를 실험적으로 튜닝해야 한다【676536220397772†L905-L931】.

위에서 제시한 Fire‑and‑forget 방식, `partitionsConsumedConcurrently` 활용, `eachBatch` 패턴, flush 파라미터 조정 등을 적용하면 배포 환경에서도 **초당 수천 건** 수준의 처리량을 회복할 수 있을 것이다. 추가로, 실패한 문서의 재처리와 정확한 오프셋 관리를 위해 로그 저장소 상태와 Kafka 오프셋을 함께 관리하는 로직을 설계하는 것이 좋다.
