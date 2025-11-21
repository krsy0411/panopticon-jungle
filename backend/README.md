## 🐳 Backend Images for CI/CD

NestJS 백엔드는 다음 두 이미지로 분리해 ECS에 개별 배포할 수 있습니다.

```
backend/src
├── query-api          # HTTP 요청을 받아 OpenSearch에서 읽기 전용 응답 제공
├── stream-processor   # MSK(Kafka)에서 소비한 로그·스팬을 정제 후 저장
├── error-stream       # apm.logs.error 토픽을 WebSocket으로 중계해 실시간 알림 제공
└── shared             # DTO/Repository/인프라 연결 등 공통 모듈
```

| 이미지 | Docker target | 역할 |
| ------ | ------------- | ---- |
| `panopticon-query-api` | `query-api` | 브라우저 요청을 받아 OpenSearch를 조회하는 읽기 전용 API |
| `panopticon-stream-processor` | `stream-processor` | MSK(Kafka) 스트림을 소비해 로그/스팬을 정제 후 OpenSearch에 적재 |
| `panopticon-error-stream` | `error-stream` | `apm.logs.error` 토픽을 구독해 WebSocket 으로 프런트엔드(NEXT.js)에 실시간 전송 |
| `panopticon-aggregator` | `aggregator` | `metrics-apm` 롤업 인덱스를 채우는 1분 버킷 집계 전용 워커 |

### Build & Push

```bash
# Query API
docker build -f backend/Dockerfile -t panopticon-query-api --target query-api backend

# Stream Processor
docker build -f backend/Dockerfile -t panopticon-stream-processor --target stream-processor backend

# Error Stream (Kafka → WebSocket)
docker build -f backend/Dockerfile -t panopticon-error-stream --target error-stream backend

# Aggregator (Roll-up 워커)
docker build -f backend/Dockerfile -t panopticon-aggregator --target aggregator backend

# (선택) ECR 로그인 및 푸시
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag panopticon-query-api:latest <account>.dkr.ecr.<region>.amazonaws.com/panopticon-query-api:latest
docker tag panopticon-stream-processor:latest <account>.dkr.ecr.<region>.amazonaws.com/panopticon-stream-processor:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/panopticon-query-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/panopticon-stream-processor:latest
```

ECS 태스크 정의에서는 각 이미지를 별도 컨테이너로 등록하고, MSK/OpenSearch 등 매니지드 엔드포인트를 환경 변수로 주입하면 됩니다. 로컬 개발 시에는 `infra/docker-compose.yml`을 이용해 동일한 이미지를 Compose 빌드 타깃으로 실행할 수 있습니다.

### NPM Scripts

- `npm run build:query-api` / `npm run build:stream-processor`: 각 서버만 컴파일
- `npm run build:error-stream`: WebSocket 기반 에러 스트림 서버 컴파일
- `npm run build:aggregator`: 롤업 워커(1분 집계)만 컴파일
- `npm run start:prod`: `dist/query-api/query-api/main.js` 실행 (읽기 API)
- `npm run start:stream-processor:prod`: `dist/stream-processor/stream-processor/main.js` 실행 (Kafka 컨슈머)
- `npm run start:error-stream:prod`: `dist/error-stream/main.js` 실행 (Kafka→WebSocket 브리지)
- `npm run start:aggregator:prod`: `dist/aggregator/main.js` 실행 (roll-up 워커)

### Error Stream 환경 변수

| 변수 | 설명 |
| --- | --- |
| `KAFKA_APM_LOG_ERROR_TOPIC` | 기본 `apm.logs.error`. MSK 토픽 이름 |
| `ERROR_STREAM_KAFKA_CLIENT_ID` / `ERROR_STREAM_KAFKA_GROUP_ID` | MSK 클러스터 연결용 Kafka client/group 식별자 |
| `ERROR_STREAM_PORT` | WebSocket 서버 포트 (기본 3010) |
| `ERROR_STREAM_WS_ORIGINS` | 허용할 Origin 목록. 콤마로 구분 (기본 모든 Origin 허용) |
| `ERROR_STREAM_WS_PATH` | WebSocket 엔드포인트 경로 (기본 `/ws/error-logs`) |
- `npm run test:app-log` / `npm run test:http-log`: 로컬에서 샘플 Kafka 메시지 전송 (필요 시 `KAFKA_BROKERS_LOCAL=localhost:9092` 등으로 브로커 주소를 덮어쓰세요)

### Stream Processor 성능 로깅

Kafka 컨슈머 처리량을 주기적으로 파악하고 싶다면 다음 환경 변수를 설정하세요. 값이 없으면 기본 설정(가벼운 샘플링)으로 동작합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `STREAM_THROUGHPUT_BATCH_SIZE` | `5000` | 누적 처리 건수가 이 값 이상 증가했을 때만 처리량 로그를 남깁니다. 0 이하로 설정하면 기능이 꺼집니다. |
| `STREAM_THROUGHPUT_MIN_INTERVAL_MS` | `10000` | 처리량 로그 사이의 최소 간격(ms). 너무 잦은 로깅을 방지합니다. |
| `STREAM_THROUGHPUT_TARGET_COUNT` | _(옵션)_ | 총 N건 처리 완료까지의 예상 소요 시간을 로그에 함께 표시합니다. |

### Bulk 색인 버퍼 옵션

`apm.logs`/`apm.spans` 컨슈머는 Elasticsearch `_bulk` API로 배치 색인을 수행합니다. 아래 환경 변수를 통해 버퍼 크기와 플러시 동시성을 조정할 수 있습니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `BULK_BATCH_SIZE` | `500` | 버퍼에 일정 건수 이상 쌓이면 즉시 flush 합니다. |
| `BULK_BATCH_BYTES_MB` | `5` | 문서 크기 합계가 지정한 MB를 넘기면 즉시 flush 합니다. |
| `BULK_FLUSH_INTERVAL_MS` | `1000` | 위 조건을 만족하지 않아도 해당 시간이 지나면 주기적으로 flush 합니다. |
| `BULK_MAX_PARALLEL_FLUSHES` | `1` | 동시에 실행할 bulk 요청 개수. 클러스터 부하에 맞게 1~4 사이에서 조정하세요. |

### Aggregator & Query API 롤업 설정

`rollup_metrics_spec.md`에 정의된 대로 1분 버킷 롤업을 도입했습니다. `panopticon-aggregator` 컨테이너가 `metrics-apm` 데이터 스트림을 채우고, Query API는 긴 구간(기본 5분 이상)을 조회할 때 자동으로 롤업 데이터를 읽어 raw 집계와 결합합니다.

- Aggregator 환경 변수는 `backend/src/aggregator/README.md`에 정리되어 있습니다. 필요한 최소 값은 `ELASTICSEARCH_*` 연결 정보와 `ROLLUP_AGGREGATOR_ENABLED` 정도이며, 나머지는 기본값(1분 버킷, 15초 폴링 등)을 따릅니다.
- Query API는 다음 변수를 통해 롤업 전략을 제어합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ROLLUP_ENABLED` | `true` | `false`이면 항상 raw 집계만 사용합니다. |
| `ROLLUP_THRESHOLD_MINUTES` | `5` | 조회 구간 길이가 이 값 이상이면 `to - threshold` 이전 범위를 롤업 데이터로 채웁니다. |
| `ROLLUP_BUCKET_MINUTES` | `1` | 롤업 데이터가 사용하는 버킷 크기. 분 단위로 정렬/정규화할 때 사용합니다. |
| `ROLLUP_CACHE_TTL_SECONDS` | `60` | Redis에 저장되는 롤업 결과 TTL. 큰 구간 조회 시 반복 요청을 가볍게 합니다. |
| `ROLLUP_CACHE_PREFIX` | `apm:metrics-rollup` | 롤업 결과 캐시 키 접두사. raw 캐시(`METRICS_CACHE_PREFIX`)와 분리합니다. |
| `ROLLUP_MAX_QUERY_BUCKETS` | `43200` | 한 번의 롤업 조회에서 허용할 최대 버킷 수(기본 30일=43,200분). 과도한 범위를 방지합니다. |

> ⚠️ 롤업 데이터는 1분 버킷 기준으로 정렬되므로 from/to가 분 단위에 맞지 않아도 자동으로 버킷 경계에 맞춰 조회합니다. 최대 1분 이내의 오차가 있을 수 있다는 점을 염두에 두고 UX를 설계하세요.

### Query API 성능 프로파일링

서비스 메트릭 엔드포인트(`GET /services/{serviceName}/metrics`)가 Elasticsearch 집계를 수행하는데 걸린 시간을 확인하려면 `SERVICE_METRICS_PROFILE=true`를 설정하면 됩니다.  
활성화 시 `metrics-profile`(중간 단계)와 `metrics-total`(전체 소요시간) 로그가 콘솔에 출력됩니다.
