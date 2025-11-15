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

### Build & Push

```bash
# Query API
docker build -f backend/Dockerfile -t panopticon-query-api --target query-api backend

# Stream Processor
docker build -f backend/Dockerfile -t panopticon-stream-processor --target stream-processor backend

# Error Stream (Kafka → WebSocket)
docker build -f backend/Dockerfile -t panopticon-error-stream --target error-stream backend

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
- `npm run start:prod`: `dist/query-api/query-api/main.js` 실행 (읽기 API)
- `npm run start:stream-processor:prod`: `dist/stream-processor/stream-processor/main.js` 실행 (Kafka 컨슈머)
- `npm run start:error-stream:prod`: `dist/error-stream/main.js` 실행 (Kafka→WebSocket 브리지)

### Error Stream 환경 변수

| 변수 | 설명 |
| --- | --- |
| `KAFKA_APM_LOG_ERROR_TOPIC` | 기본 `apm.logs.error`. MSK 토픽 이름 |
| `ERROR_STREAM_KAFKA_CLIENT_ID` / `ERROR_STREAM_KAFKA_GROUP_ID` | MSK 클러스터 연결용 Kafka client/group 식별자 |
| `ERROR_STREAM_PORT` | WebSocket 서버 포트 (기본 3010) |
| `ERROR_STREAM_WS_ORIGINS` | 허용할 Origin 목록. 콤마로 구분 (기본 모든 Origin 허용) |
| `ERROR_STREAM_WS_PATH` | WebSocket 엔드포인트 경로 (기본 `/ws/error-logs`) |
- `npm run test:app-log` / `npm run test:http-log`: 로컬에서 샘플 Kafka 메시지 전송 (필요 시 `KAFKA_BROKERS_LOCAL=localhost:9092` 등으로 브로커 주소를 덮어쓰세요)
