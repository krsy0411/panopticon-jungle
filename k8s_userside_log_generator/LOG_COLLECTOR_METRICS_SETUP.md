# Log Collector CPU 메트릭 수집 설정

쿠버네티스의 **log-collector Pod (3001번 포트 서버)** CPU 사용량을 수집합니다.

---

## 로컬에서 테스트하는 방법

### 1. 사전 준비
- Docker Desktop 실행
- kind 클러스터 실행 중
- Kafka, TimescaleDB 실행 중 (`cd infra && docker-compose up -d`)

### 2. FluentBit 설정 적용

```bash
# 1. 설정 배포
cd k8s_userside_log_generator/k8s_http_to_flu_to_server
kubectl apply -f fluent-bit.yaml

# 2. FluentBit 재시작
kubectl rollout restart daemonset/fluent-bit -n default

# 3. 재시작 완료 대기 (30초~1분)
kubectl rollout status daemonset/fluent-bit -n default
```

### 3. 백엔드 실행

```bash
cd backend
npm run start:dev:metrics-consumer
```

**30초마다 이런 로그가 나오면 성공:**
```
[SYSTEM METRIC] service=log-collector pod=log-collector-xxx CPU=15.00% Memory=200Mi
```

### 4. 데이터 확인

```bash
# TimescaleDB에서 확인
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -c "
  SELECT
    time,
    service,
    pod_name,
    cpu_usage_percent
  FROM system_metrics
  WHERE service = 'log-collector'
  ORDER BY time DESC
  LIMIT 5;
"
```

---

## test-log-collector-metrics.sh 파일

자동 테스트 스크립트입니다. 다음을 자동으로 확인합니다:
- FluentBit Pod 상태
- log-collector Pod 상태
- FluentBit 설정
- Kafka 메시지

**사용법:**
```bash
cd k8s_userside_log_generator
./test-log-collector-metrics.sh
```

---

## 트러블슈팅

### "데이터가 안 들어와요"

1. **log-collector Pod 확인**
   ```bash
   kubectl get pods | grep log-collector
   ```

2. **FluentBit 재시작**
   ```bash
   kubectl rollout restart daemonset/fluent-bit -n default
   ```

3. **30초 기다리기** (FluentBit이 30초마다 수집함)

4. **Kafka 확인**
   ```bash
   docker exec panopticon-kafka /opt/kafka/bin/kafka-console-consumer.sh \
     --bootstrap-server localhost:9092 \
     --topic metrics.system \
     --max-messages 5
   ```

---

## 요약

1. `kubectl apply -f fluent-bit.yaml` - 설정 적용
2. `kubectl rollout restart daemonset/fluent-bit` - 재시작
3. `npm run start:dev:metrics-consumer` - 백엔드 실행
4. 30초 기다리기
5. TimescaleDB에서 확인
