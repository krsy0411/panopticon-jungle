# 👀 Panopticon

“모든 서비스의 로그를 한눈에 관찰하다.”

## 🌿 Branch Naming

| 타입          | 예시                    | 설명                                                  |
| ------------- | ----------------------- | ----------------------------------------------------- |
| **feature/**  | `feature/signup-ui`     | 새로운 기능 개발                                      |
| **fix/**      | `fix/post-api-error`    | 오류 수정 (일반 + 긴급)                               |
| **refactor/** | `refactor/comment-hook` | 리팩토링 (기능 변화 없고 코드 구조 개선과 관련)       |
| **test/**     | `test/routing-next`     | 테스트 (기능 개발과 관계없이 테스트가 필요할때)       |
| **...**       | `...`                   | 코드 구현과 관련없는 이외의 작업들은 바로 Main에 커밋 |

---

> 각 브랜치는 **작업 목적이 명확하게 드러나도록** 이름을 붙이세요
> 예: `feature/login-api`, `fix/user-auth-bug`, `refactor/dashboard-layout`

---

## 💬 Conventional Commits

```
<type>(<scope>): <subject>
```

- **type**: 커밋의 유형 (예: `feat`, `fix`, `docs` 등)
- **scope**: 변경된 범위나 영역 (선택 사항)
- **subject**: 간단한 변경 내용 설명

---

| 타입                | 설명                                                              | 예시                                          |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| **feat**            | 새로운 기능을 추가할 때 사용                                      | `[feat(auth)]: 소셜 로그인 기능 추가`         |
| **refactor**        | 코드 리팩토링, 기능 추가나 버그 수정 아님                         | `[refactor(user-service)]: 로직 최적화`       |
| **fix**             | 버그 수정 시 사용                                                 | `[fix(api)]: 로그인 오류 수정`                |
| **docs**            | 문서 수정 (코드 변경 없음)                                        | `[docs(readme)]: 설치 가이드 업데이트`        |
| **style**           | 코드 형식이나 포맷 변경 (기능 변화 없음)                          | `[style(global)]: 들여쓰기 규칙 통일`         |
| **test**            | 테스트 코드 추가 또는 수정                                        | `[test(api)]: 인증 기능 테스트 추가`          |
| **chore**           | 빌드 프로세스 변경, 패키지 업데이트 등 코드와 직접 관련 없는 작업 | `[chore(build)]: 의존성 패키지 업데이트`      |
| **perf**            | 성능을 개선하기 위한 코드 변경                                    | `[perf(images)]: 이미지 로딩 속도 개선`       |
| **BREAKING CHANGE** | 호환성을 깨는 변경 사항을 설명할 때 사용                          | `[BREAKING CHANGE]: 스키마가 변경되었습니다.` |

## 🐳 Backend Images for CI/CD

NestJS 백엔드는 다음 두 이미지로 분리해 ECS에 개별 배포할 수 있습니다.

```
backend/src
├── query-api          # HTTP 요청을 받아 DB(OpenSearch/Timescale)에서 읽기 전용 응답 제공
├── stream-processor   # MSK(Kafka)에서 소비한 로그·메트릭을 정제 후 저장
└── shared             # DTO/Repository/인프라 연결 등 공통 모듈
```

| 이미지 | Docker target | 역할 |
| ------ | ------------- | ---- |
| `panopticon-query-api` | `query-api` | 브라우저 요청을 받아 OpenSearch/TimescaleDB를 조회하는 읽기 전용 API |
| `panopticon-stream-processor` | `stream-processor` | MSK(Kafka) 스트림을 소비해 로그/메트릭을 정제 후 OpenSearch/TimescaleDB에 적재 |

### Build & Push

```bash
# Query API
docker build -f backend/Dockerfile -t panopticon-query-api --target query-api backend

# Stream Processor
docker build -f backend/Dockerfile -t panopticon-stream-processor --target stream-processor backend

# (선택) ECR 로그인 및 푸시
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag panopticon-query-api:latest <account>.dkr.ecr.<region>.amazonaws.com/panopticon-query-api:latest
docker tag panopticon-stream-processor:latest <account>.dkr.ecr.<region>.amazonaws.com/panopticon-stream-processor:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/panopticon-query-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/panopticon-stream-processor:latest
```

ECS 태스크 정의에서는 각 이미지를 별도 컨테이너로 등록하고, MSK/OpenSearch/Timescale 등 매니지드 엔드포인트를 환경 변수로 주입하면 됩니다. 로컬 개발 시에는 `infra/docker-compose.yml`을 이용해 동일한 이미지를 Compose 빌드 타깃으로 실행할 수 있습니다.

### NPM Scripts

- `npm run build:query-api` / `npm run build:stream-processor`: 각 서버만 컴파일
- `npm run start:prod`: `dist/query-api/query-api/main.js` 실행 (읽기 API)
- `npm run start:stream-processor:prod`: `dist/stream-processor/stream-processor/main.js` 실행 (Kafka 컨슈머)
- `npm run test:app-log` / `npm run test:http-log`: 로컬에서 샘플 Kafka 메시지 전송 (필요 시 `KAFKA_BROKERS_LOCAL=localhost:9092` 등으로 브로커 주소를 덮어쓰세요)
