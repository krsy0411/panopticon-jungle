# Panopticon Producer

Kafka Producer 서비스 - 로그/메트릭을 Kafka와 S3로 전송

# 👀 Panopticon

"모든 서비스의 로그를 한눈에 관찰하다."

---

## 🚀 Quick Start

### 로컬 개발 환경

1. **환경변수 설정**

   ```bash
   cp .env.example .env.development
   # .env.development 파일을 열어 필요한 값 수정
   ```

2. **로컬 Kafka/S3 실행**

   ```bash
   npm run docker:dev:up
   ```

3. **애플리케이션 실행**

   ```bash
   npm install
   npm run start:dev
   ```

4. **서비스 확인**
   - Producer API: http://localhost:3000
   - Kafka UI: http://localhost:8080

### 배포 환경

배포 환경에서는 `.env` 파일을 사용하지 않고, Kubernetes/ECS 환경변수를 직접 설정합니다.

**필수 환경변수:**

```bash
NODE_ENV=production
MSK_BROKERS=<MSK 엔드포인트>
S3_BUCKET=<S3 버킷명>
AWS_REGION=ap-northeast-2
```

---

## 📋 Available Scripts

| 명령어                    | 설명                                  |
| ------------------------- | ------------------------------------- |
| `npm run start:dev`       | 로컬 개발 모드 (NODE_ENV=development) |
| `npm run start:prod`      | 프로덕션 모드 (NODE_ENV=production)   |
| `npm run docker:dev:up`   | 로컬 Kafka/S3 실행                    |
| `npm run docker:dev:down` | 로컬 Kafka/S3 종료                    |
| `npm run docker:dev:logs` | 로컬 서비스 로그 확인                 |
| `npm run build`           | 프로덕션 빌드                         |

---

## s3 데이터 확인하는 법(CLI)

### AWS CLI 설치 (없으면)

brew install awscli

### LocalStack S3 버킷 리스트

aws --endpoint-url=http://localhost:4566 s3 ls

### 특정 버킷 내용 확인

aws --endpoint-url=http://localhost:4566 s3 ls
s3://panopticon-s3/

### 파일 다운로드해서 확인

aws --endpoint-url=http://localhost:4566 s3 cp
s3://panopticon-s3/raw/test.json ./test.json
cat test.json

---

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
