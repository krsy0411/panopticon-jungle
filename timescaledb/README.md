# TimescaleDB(로컬) — panopticon

 이 폴더에는 로컬 테스트용 TimescaleDB(Postgres) 설정과 간단한 초기화 스크립트가 들어있습니다.

### 파일 구성
- `docker-compose.timescale.yml` — TimescaleDB용 docker-compose 설정 (이미지: `timescale/timescaledb:latest-pg16`).
- `init_timescale_test.sql` — idempotent(여러 번 실행해도 안전한) 초기화 SQL 스크립트: `test_metrics` 하이퍼테이블 생성, 샘플 데이터 삽입, 예제 쿼리 포함.

### 빠른 시작

1) 저장소 루트에서 실행:

    ```bash
    # TimescaleDB를 백그라운드로 실행합니다.
    docker compose -f timescaledb/docker-compose.timescale.yml up -d
    ```

2) 컨테이너 실행 확인:

    ```bash
    docker ps --filter "name=panopticon-timescaledb"
    ```

### 옵션 1) psql로 접속하기

> psql로 접속해서 직접 SQL문을 실행해볼 수 있습니다(옵션 2와는 별개입니다)

> `\q`로 종료합니다.

psql 실행:

```bash
docker exec -it panopticon-timescaledb psql -U admin -d panopticon
```

### 옵션 2) 초기화 SQL 적용하기

> 🥕 각자가 편하게 사용할 수 있도록 SQL문 예시를 만든겁니다.

repo 루트에서 docker exec로 적용:

```bash
# 로컬 파일을 컨테이너의 psql로 파이프합니다.
docker exec -i panopticon-timescaledb psql -U admin -d panopticon -f /dev/stdin < timescaledb/init_timescale_test.sql
```

#### init SQL이 수행하는 작업

- `timescaledb` 확장이 없으면 생성합니다.
- `test_metrics` 테이블을 만들고 하이퍼테이블로 변환합니다.
- 몇 개의 샘플 행을 삽입합니다.
- 예제 쿼리(time_bucket 집계, 이동 평균, 하이퍼테이블 메타데이터)를 실행합니다.

### 중지 / 정리

```bash
# 컨테이너를 중지/삭제합니다(데이터는 named volume에 남습니다).
docker compose -f timescaledb/docker-compose.timescale.yml down

# 컨테이너를 중지/삭제하고 named volume도 제거(데이터 삭제)
docker compose -f timescaledb/docker-compose.timescale.yml down -v
```