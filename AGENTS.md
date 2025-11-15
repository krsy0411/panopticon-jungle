# Repository Guidelines

## Project Structure & Module Organization
모노레포 루트에는 `backend`(주요 NestJS 모노앱), `producerServer`, `app_api`, `infra`, `k8s_userside_log_generator` 가 있습니다. 일상 개발은 `backend` 디렉터리에서 수행하며 `src/query-api`(읽기 전용 API), `src/stream-processor`(카프카 소비자), `src/shared`(공용 DTO·서비스)로 나뉩니다. 런타임 산출물은 `dist/`에 생성되고, 환경 전용 설정은 `.env`, `.env.local`, `infra/docker-compose.yml` 등에 위치합니다. 테스트 스위트는 `src/**/*.spec.ts`에 두고, 샘플 수집 스크립트는 `src/stream-processor/log-consumer/app` 하위에 있습니다.

## Build, Test, and Development Commands
모든 명령은 `backend`에서 실행합니다. `npm run start:query-api`, `npm run start:log-consumer`, `npm run start:metrics-consumer` 는 각각의 Nest 엔트리를 ts-node로 부팅합니다. 프로덕션 빌드는 `npm run build` 또는 서비스별 `npm run build:query-api`, `npm run build:stream-processor` 로 생성합니다. 로컬 통합 확인 시 `docker compose -f infra/docker-compose.yml up kafka elasticsearch redis` 로 인프라를 띄운 뒤 애플리케이션을 npm 스크립트로 실행합니다. 샘플 이벤트는 `npm run test:app-log`·`npm run test:http-log` 로 발행합니다.

## Coding Style & Naming Conventions
TypeScript 2-스페이스 인덴트, `camelCase` 변수, `PascalCase` 클래스/DTO, `UPPER_SNAKE_CASE` 환경 키를 사용합니다. 의존성 주입은 NestJS 데코레이터(`@Injectable`, `@Module`, `@Controller`)로 구현하며, 비즈니스 로직은 `src/shared`의 서비스·도메인 계층으로 이동합니다. ESLint(설정: `eslint.config.mjs`)와 Prettier를 함께 사용하며, 커밋 전 `npm run lint` 또는 최소한 `npm run format:check`를 실행합니다. 환경 값은 `load-env.ts`에서 불러오므로 `.env.local` 내 민감 정보는 Git에 추적하지 않습니다.

## Testing Guidelines
단위 테스트는 Jest 기반이며 파일명은 `*.spec.ts`로 끝나야 합니다. 전체 스위트는 `npm test`, 커버리지는 `npm run test:cov`, 워치는 `npm run test:watch`, E2E는 `npm run test:e2e`로 실행합니다. 새 모듈을 추가할 때는 서비스 레이어에 대한 단위 테스트와, Kafka·Elasticsearch·Redis 의존성이 있는 경우 환경을 모킹하거나 통합 테스트를 `infra` 컴포즈 스택에 의존해 작성합니다.

## Commit & Pull Request Guidelines
커밋 메시지는 짧은 명령형 한국어/영문 한 줄(예: `fix: tsdb guard 추가`)로 작성하고, 관련 이슈나 작업 번호를 괄호나 바디에 링크합니다. PR 설명에는 **변경 요약**, **테스트 방법**, **환경 변수 추가/수정 사항**, **배포 체크리스트**를 포함합니다. 기능 플래그(`USE_ISM`, `OPENSEARCH_*`, `KAFKA_BROKERS*`, `REDIS_HOST`)를 변경했다면 PR 본문에 반드시 명시하고 인프라 담당자와 사전 협의합니다.

## Security & Configuration Tips
필수 환경 변수는 `ELASTICSEARCH_NODE`, `KAFKA_BROKERS`, `USE_ISM`, `OPENSEARCH_USERNAME/PASSWORD`, `OPENSEARCH_REJECT_UNAUTHORIZED`, `REDIS_HOST`입니다. 로컬 개발은 `.env.local`, AWS ECS는 태스크 정의/Secrets Manager에 값을 주입하십시오. 민감한 자격 증명은 절대 Git에 커밋하지 말고, 필요 시 `dotenvx` 같은 도구로 암호화·배포하십시오.
