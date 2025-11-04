# Panopticon Infrastructure

이 폴더는 Panopticon 프로젝트의 모든 인프라 컨테이너를 통합 관리합니다.

## 포함된 서비스

| 서비스 | 포트 | 용도 |
|--------|------|------|
| Kafka | 9092 | 메시지 큐 (로그/메트릭 스트림) |
| TimescaleDB | 5433 | 시계열 메트릭 저장소 (PostgreSQL) |
| Elasticsearch | 9200 | 로그 검색 저장소 |
| Kibana | 5601 | Elasticsearch UI |
| Redis | 6379 | 실시간 집계 캐시 |

## 사용 방법

### 전체 인프라 시작

```bash
cd infra
docker compose up -d
```

### 전체 인프라 중지

```bash
docker compose down
```

### 로그 확인

```bash
# 전체 로그
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f kafka
docker compose logs -f timescaledb
docker compose logs -f elasticsearch
```

### 상태 확인

```bash
docker compose ps
```

### 특정 서비스만 시작/중지

```bash
# Kafka만 시작
docker compose up -d kafka

# Redis만 재시작
docker compose restart redis

# Elasticsearch 중지
docker compose stop elasticsearch
```

### 데이터 초기화 (주의!)

```bash
# 모든 컨테이너와 볼륨 삭제
docker compose down -v
```

## 서비스별 접속 정보

### TimescaleDB

```bash
# psql 접속
docker compose exec timescaledb psql -U admin -d panopticon

# 또는 로컬에서
psql -h localhost -p 5433 -U admin -d panopticon
# Password: admin123
```

### Elasticsearch

```bash
# Health check
curl http://localhost:9200/_cluster/health?pretty

# Index 목록
curl http://localhost:9200/_cat/indices?v
```

### Kibana

브라우저에서 접속: http://localhost:5601

### Redis

```bash
# redis-cli 접속
docker compose exec redis redis-cli

# 또는 로컬에서
redis-cli -h localhost -p 6379
```

### Kafka

```bash
# Topic 목록
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Topic 생성
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic logs --partitions 3 --replication-factor 1
```

## 트러블슈팅

### 포트 충돌

만약 포트가 이미 사용중이라면 `docker-compose.yml`에서 포트 매핑을 변경하세요:

```yaml
ports:
  - "9093:9092"  # 9092 대신 9093 사용
```

### 컨테이너 재시작

```bash
docker compose restart <service-name>
```

### 완전히 재설치

```bash
docker compose down -v
docker compose up -d
```

## 네트워크

모든 서비스는 `panopticon-network` 브릿지 네트워크에 연결되어 있어 서로 통신할 수 있습니다.

컨테이너 내부에서는 서비스 이름으로 접근 가능합니다:
- `kafka:9092`
- `timescaledb:5432`
- `elasticsearch:9200`
- `redis:6379`
