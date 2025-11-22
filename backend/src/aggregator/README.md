# Aggregator 서버

이 디렉터리는 `rollup_metrics_spec.md` 에 정의된 1분 버킷 롤업 파이프라인을 담당하는 NestJS 애플리케이션이다. `stream-processor` 가 Kafka 메시지를 인덱싱하는 경로와 완전히 분리된 별도 후처리 파이프라인으로 동작하며, 다음과 같은 책임을 가진다.

1. `logs-apm`/`traces-apm` 과 같은 raw 인덱스에서는 **쓰기에만 집중**하도록 두고, Aggregator 는 닫힌 분(minute)에 대한 집계만 수행한다.
2. `ROLLUP_CHECKPOINT_INDEX` 에 `last_rolled_up_at` 값을 기록하여, 이미 처리한 분 이하로는 다시 집계하지 않는다.
3. 분 단위 집계 결과는 `LogStorageService` 가 관리하는 `metrics-apm` 데이터 스트림(`apmRollupMetrics` 키)으로 `_bulk create` 된다.

## 실행 방법

```bash
cd backend
npm run start:aggregator
```

프로덕션 모드에서는 `npm run build:aggregator && node dist/aggregator/main.js` 로 실행한다. Aggregator 는 HTTP 서버를 열지 않고, Nest `ApplicationContext` 안에서 주기적인 작업 스케줄러만 구동한다.

## 주요 구성 요소

- `RollupConfigService`: 모든 환경 변수를 한 곳에서 파싱하여 서비스 간 결합을 줄인다.
- `RollupCheckpointService`: `metrics-rollup-state` 인덱스에 `lastRolledUpAt` 값을 기록/조회한다. 데이터가 없는 분이라도 한번 처리하면 end timestamp 를 기록해 재집계를 방지한다.
- `MinuteWindowPlanner`: 현재 시각과 체크포인트를 비교해 닫힌 분만 돌려준다.
- `SpanMinuteAggregationService`: 지정된 1분 구간에서 서비스/환경 별 percentiles · error rate 를 구한다.
- `RollupMetricsRepository`: `_bulk` API 로 롤업 Data Stream 에 create 작업을 수행한다. 이미 같은 키가 존재하면 idempotent 하게 건너뛴다.
- `AggregatorRunner`: 위 구성 요소를 orchestration 하여 SOLID 원칙을 지킬 수 있도록 했다.

## 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ROLLUP_AGGREGATOR_ENABLED` | `true` | false 이면 애플리케이션은 부팅만 하고 집계를 시작하지 않는다. |
| `ROLLUP_BUCKET_SECONDS` | `60` | 버킷 길이(초). 문서에는 1분 버킷을 권장한다. |
| `ROLLUP_POLL_INTERVAL_MS` | `15000` | 닫힌 분을 확인하는 주기. |
| `ROLLUP_INITIAL_LOOKBACK_MINUTES` | `5` | 체크포인트가 없을 때 얼마만큼 과거로 돌아가 catch-up 할지 결정한다. |
| `ROLLUP_MAX_SERVICE_BUCKETS` | `200` | 단일 분에서 최대 몇 개의 서비스가 등장할지 추정한 값. |
| `ROLLUP_MAX_ENV_BUCKETS` | `10` | 서비스 내 환경 버킷의 상한. |
| `ROLLUP_INDEX_PREFIX` | `metrics-apm` | data stream 명을 결정할 때 사용된다. |
| `ROLLUP_CHECKPOINT_INDEX` | `.metrics-rollup-state` | `last_rolled_up_at` 을 저장하는 전용 인덱스 이름(데이터 스트림 템플릿과 충돌하지 않도록 기본적으로 숨김 인덱스를 사용). |
| `ELASTICSEARCH_APM_ROLLUP_STREAM` | `metrics-apm` | 실제 롤업 데이터 스트림 이름. |

모든 환경 변수는 `load-env.ts` 를 통해 `.env/.env.local` 에서 읽히며, 기존 서비스와 동일한 방식으로 구성한다.
