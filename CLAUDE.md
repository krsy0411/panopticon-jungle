# SRE 모니터링 플랫폼

## 📋 프로젝트 설명

애플리케이션의 로그와 메트릭을 **실시간으로** 수집·분석하여 즉각적인 알림과 대시보드를 제공하는 SRE 모니터링 플랫폼입니다.

**핵심 목표:** 
- ⚡ **실시간 처리** (5초 이내 알림)
- 🎯 **즉각적 문제 감지** (골든타임 확보)
- 📊 **실시간 대시보드** (자동 업데이트)

**타겟 사용자:** SRE/DevOps 엔지니어, 24/7 모니터링이 필요한 조직

**유사 서비스:** Datadog APM, New Relic (실시간 알림 제공)

---

## 🎯 핵심 기능

### 1. 실시간 APM (4 Golden Signals)
**문제 발생 → 5초 이내 감지 및 알림**

- **Latency**: API 응답 시간 (P50, P95, P99) - 1초 단위 업데이트
- **Error**: 에러율 실시간 추적 - 즉시 탐지
- **Traffic**: TPS 실시간 모니터링
- **Saturation**: CPU/메모리 사용률 - 실시간 그래프

### 2. 실시간 SLO 알림
**지연 없는 즉각 알림 시스템**

```
12:00:00 - API 응답시간 250ms 발생 (SLO: 200ms)
12:00:02 - Redis에서 실시간 집계 (P95 계산)
12:00:03 - SLO 위반 감지
12:00:04 - Slack 알림 발송
12:00:05 - 대시보드 자동 업데이트
```

**기존 배치 방식과의 차이:**
- ❌ 배치: 30초~1분 지연 → 골든타임 상실
- ✅ 실시간: 3~5초 이내 → 즉각 대응 가능

### 3. 자동 업데이트 대시보드
**새로고침 불필요 - WebSocket 기반 실시간 푸시**

- 그래프 1초마다 자동 업데이트
- 새 데이터 즉시 반영
- 실시간 이상 패턴 하이라이트
- 서비스별 필터링

### 4. 지능형 문제 분석

**MVP 버전 (실시간 기반):**
- 실시간 임계값 기반 알림 (< 5초)
- 에러율 급증 즉시 탐지
- 동시간대 메트릭 상관관계 실시간 표시

**고도화 계획:**
- 실시간 이상 탐지 (Anomaly Detection)
- 스트림 기반 근본 원인 분석
- 예측 알림 (30초 후 장애 예상)

---

## 🏗️ 아키텍처 (실시간 중심 설계)

### 핵심 설계 원칙
> **"대용량 처리보다 실시간성 우선"** - 적은 데이터라도 즉시 사용자에게 전달

### 전체 구조

```
[실시간 처리 경로] ⚡ < 5초
애플리케이션
  └─ FluentBit
       └─ Kafka
            └─ NestJS Stream Processor
                 ├─ Redis (실시간 집계, 1분 윈도우)
                 │   - 최근 1-5분 데이터만 메모리 보관
                 │   - 초고속 조회 (< 10ms)
                 │   - TTL 자동 만료
                 │
                 ├─ 즉시 SLO 체크 (메모리)
                 │   - Redis에서 P95 계산
                 │   - 임계값 비교
                 │
                 ├─ 즉시 알림 (비동기)
                 │   └─ Slack/Email 병렬 전송
                 │
                 └─ WebSocket Push
                      └─ Next.js (실시간 대시보드)

[배치 저장 경로] 📦 비동기
Background Job (낮은 우선순위)
  └─ Redis → TimescaleDB (메트릭, PostgreSQL 기반)
  └─ Kafka → Elasticsearch (로그)
  └─ 알림 이력 → PostgreSQL
```

### 데이터 흐름 타임라인

```
T+0초   : 애플리케이션에서 로그 발생
T+0.5초 : FluentBit → Kafka 전송
T+1초   : NestJS Consumer 수신
T+1.5초 : Redis 실시간 집계 (P95 계산)
T+2초   : SLO 체크 완료
T+2.5초 : Slack 알림 전송 시작
T+3초   : WebSocket으로 클라이언트 푸시
T+3.5초 : 대시보드 그래프 자동 업데이트
------- (여기까지 실시간 처리 완료) -------
T+30초  : Background에서 InfluxDB 저장 (비동기)
```

### 기술 스택

| 레이어 | 기술 | 역할 | 실시간 최적화 |
|--------|------|------|--------------|
| 수집 | FluentBit | 로그/메트릭 수집 | 버퍼 최소화 (1초) |
| 메시지큐 | Kafka | 스트림 전달 | 저지연 설정 |
| 백엔드 | NestJS | Stream Processor | 메시지 즉시 처리 |
| 실시간 캐시 | **Redis** | 1분 윈도우 집계 | TTL 5분, < 10ms 응답 |
| 메트릭 저장 | **TimescaleDB** | 장기 보관 (PostgreSQL 기반) | 백그라운드 저장 |
| 로그 저장 | **Elasticsearch** | 검색용 | 백그라운드 저장 |
| 설정 DB | PostgreSQL | 사용자/SLO | 쓰기 빈도 낮음 |
| 실시간 통신 | **WebSocket** | 대시보드 푸시 | Socket.io |
| 프론트엔드 | Next.js | 실시간 UI | 자동 업데이트 |

### Redis 실시간 집계 구조

```
Redis (메모리 캐시)
├─ metrics:{service}:latency:1m    (최근 1분 latency 값들)
├─ metrics:{service}:error:1m      (최근 1분 에러 카운트)
├─ metrics:{service}:traffic:1m    (최근 1분 요청 수)
└─ slo:{service}:status            (현재 SLO 준수 여부)

각 키마다 TTL 5분 → 자동 삭제
```

### 데이터베이스 역할 분리

**Redis** - 실시간 데이터 (0~5분)
```
- 최근 1분/5분 윈도우 메트릭
- 실시간 집계 결과 (P50, P95, P99)
- SLO 현재 상태
- TTL: 5분
```

**TimescaleDB** - 시계열 메트릭 (5분~30일, PostgreSQL Hypertable)
```sql
CREATE TABLE api_metrics (
  time TIMESTAMPTZ NOT NULL,
  service TEXT,
  endpoint TEXT,
  method TEXT,
  latency FLOAT,
  error_count INTEGER,
  request_count INTEGER
);

SELECT create_hypertable('api_metrics', 'time', if_not_exists => TRUE);

-- 자동 압축 (7일 이후 압축)
SELECT add_compression_policy('api_metrics', INTERVAL '7 days');
```

**Elasticsearch** - 로그 검색 (실시간~30일)
```json
{
  "timestamp": "2025-10-31T10:30:00Z",
  "level": "ERROR",
  "service": "user-api",
  "message": "Database connection timeout",
  "trace_id": "abc123"
}
```

**PostgreSQL** - 사용자 정보 및 설정
```
users, projects, slo_configs, alert_rules, 
alert_channels, alert_history
```

---

## 🎨 주요 화면 구성

### 1. 실시간 대시보드 (홈)
**새로고침 없이 1초마다 자동 업데이트**

- 서비스 상태 실시간 표시 (정상/경고/위험)
- 4 Golden Signals 실시간 그래프
  - 1초마다 새 데이터 포인트 추가
  - 이상 구간 빨간색 하이라이트
- 실시간 알림 스트림 (최근 10개)
- SLO 준수율 실시간 업데이트

**기술 구현:**
- WebSocket 연결로 서버에서 데이터 푸시
- React Chart.js로 실시간 그래프 렌더링
- 애니메이션 효과로 변화 강조

### 2. 메트릭 페이지
**실시간 모니터링 + 과거 데이터 조회**

- **실시간 모드** (최근 5분)
  - Redis에서 데이터 조회
  - 1초 업데이트
  - WebSocket 자동 갱신
  
- **히스토리 모드** (5분 이전)
  - InfluxDB에서 조회
  - 시간 범위 선택
  - P50/P95/P99 비교

### 3. 로그 탐색기
**실시간 로그 스트림 + 검색**

- 실시간 로그 스트리밍 (tail -f 방식)
- 키워드 검색 (Elasticsearch)
- 로그 레벨 필터
- Trace ID 연관 로그 추적

### 4. SLO 관리
**실시간 SLI vs SLO 모니터링**

- SLO 목록 및 현재 상태
- 실시간 SLI 그래프
- Error Budget 실시간 소진율
- 위반 시 즉시 알림 설정

### 5. 알림 설정
**실시간 알림 규칙 관리**

- 평가 주기 설정 (기본: 즉시)
- Debounce 설정 (중복 알림 방지, 1분)
- Slack/Email 동시 전송
- 알림 발송 히스토리 (실시간 업데이트)

---

## 💡 실시간 처리 핵심 로직

### 1. Kafka Consumer (스트림 처리)

```typescript
// ❌ 배치 방식 (느림)
setInterval(async () => {
  const messages = await consumer.fetch(100);
  await processBatch(messages);
}, 5000); // 5초 지연!

// ✅ 스트림 방식 (빠름)
consumer.on('message', async (message) => {
  await processImmediately(message); // 즉시 처리
});
```

### 2. 실시간 집계 (Redis)

```typescript
class RealtimeAggregator {
  async addMetric(metric: Metric) {
    const key = `metrics:${metric.service}:latency:1m`;
    
    // 1분 윈도우에 추가 (Sorted Set)
    await redis.zadd(key, Date.now(), metric.latency);
    
    // TTL 5분 (자동 삭제)
    await redis.expire(key, 300);
    
    // 즉시 P95 계산
    const values = await redis.zrange(key, 0, -1);
    const p95 = this.calculatePercentile(values, 0.95);
    
    // SLO 체크
    const slo = await this.getSLO(metric.service);
    if (p95 > slo.threshold) {
      await this.sendAlert(metric.service, p95, slo);
    }
    
    // WebSocket 푸시
    this.io.emit('metric-update', {
      service: metric.service,
      p95: p95,
      timestamp: Date.now()
    });
  }
}
```

### 3. 즉시 알림 (비동기 병렬)

```typescript
async function sendAlert(alert: Alert) {
  // 알림 전송 - 병렬 처리
  await Promise.all([
    slack.send(alert),
    email.send(alert),
  ]);
  
  // 이력 저장은 나중에 (비동기)
  setImmediate(() => {
    db.saveAlertHistory(alert).catch(err => 
      logger.error('알림 이력 저장 실패', err)
    );
  });
}
```

### 4. WebSocket 실시간 푸시

```typescript
// 서버 (NestJS)
@WebSocketGateway()
export class MetricsGateway {
  @SubscribeMessage('subscribe-service')
  handleSubscribe(client: Socket, service: string) {
    // Kafka에서 메시지 받을 때마다
    this.kafkaConsumer.on('message', (msg) => {
      if (msg.service === service) {
        // 클라이언트에게 즉시 전송
        client.emit('metric-update', {
          service: msg.service,
          latency: msg.latency,
          timestamp: Date.now()
        });
      }
    });
  }
}

// 클라이언트 (Next.js)
useEffect(() => {
  const socket = io('ws://api-server');
  
  socket.emit('subscribe-service', 'user-api');
  
  socket.on('metric-update', (data) => {
    // 그래프 즉시 업데이트
    setChartData(prev => [...prev, {
      x: data.timestamp,
      y: data.latency
    }]);
  });
  
  return () => socket.disconnect();
}, []);
```

### 5. 백그라운드 저장

```typescript
// 저장 큐 (Bull Queue)
const storageQueue = new Queue('metrics-storage');

// Consumer에서 큐에만 추가 (빠름)
consumer.on('message', async (msg) => {
  const metric = parseMetric(msg);
  
  // 실시간 처리 (블로킹)
  await processRealtime(metric);
  
  // TimescaleDB 저장은 큐에 추가 (논블로킹)
  await storageQueue.add({ metric });
});

// 별도 Worker에서 배치 저장
storageQueue.process(async (job) => {
  const { metric } = job.data;
  await timescaleDB.write(metric);
});
```

---

## 📊 성능 목표

### 실시간 처리 지표

| 항목 | 목표 | 기준 |
|------|------|------|
| 데이터 수집 → 알림 | < 5초 | Datadog 수준 |
| 대시보드 업데이트 | 1초 | WebSocket 실시간 |
| Redis 조회 속도 | < 10ms | 메모리 캐시 |
| SLO 체크 주기 | 즉시 (메시지당) | 지연 없음 |
| 알림 발송 | < 3초 | Slack API 기준 |
| 처리량 | 1,000 msg/s | MVP 목표 |

### 상용 서비스와 비교

| 항목 | 배치 방식 | 상용 (Datadog) | 우리 서비스 (목표) |
|------|-----------|----------------|-------------------|
| 알림 지연 | 30초~1분 | < 10초 | < 5초 |
| 대시보드 | 수동 새로고침 | 자동 업데이트 | 자동 업데이트 |
| 평가 주기 | 5분 | 1분 | 즉시 |

---

## 🚀 개발 우선순위

### Phase 1: 실시간 MVP (2-3개월)
**목표: 5초 이내 알림 시스템 구축**

- [ ] Kafka Consumer 실시간 모드
  - 메시지 즉시 처리 (배치 제거)
- [ ] Redis 실시간 집계
  - 1분 윈도우 Sorted Set
  - P95 계산 로직
- [ ] 즉시 SLO 체크
  - 메모리 기반 임계값 비교
- [ ] Slack 알림 (비동기 병렬)
- [ ] WebSocket 실시간 푸시
  - Socket.io 구현
  - 클라이언트 자동 업데이트
- [ ] 기본 대시보드
  - 실시간 그래프 (Chart.js)

### Phase 2: 안정화 및 최적화 (1-2개월)
- [ ] 백그라운드 저장 큐
  - Bull Queue 도입
  - InfluxDB 배치 저장
- [ ] Debounce 알림
  - 1분내 중복 방지
- [ ] 에러 처리 강화
  - 재시도 로직
  - Dead Letter Queue

### Phase 3: 고도화 (2-3개월)
- [ ] 실시간 이상 탐지
  - Z-score 기반
- [ ] 다중 윈도우 집계
  - 1분, 5분, 15분
- [ ] 자체 SDK 개발
  - Node.js, Python

---

## ⚠️ 주의사항

### 실시간 처리를 위한 핵심 원칙

1. **저장을 기다리지 말 것**
   - 알림/업데이트 먼저
   - 저장은 비동기로

2. **메모리 우선 사용**
   - Redis로 빠른 집계
   - DB는 장기 보관용

3. **배치 처리 금지**
   - 메시지 즉시 처리
   - 지연 최소화

4. **병렬 처리 활용**
   - Slack/Email 동시 전송
   - Promise.all 적극 사용

5. **WebSocket 필수**
   - 폴링(Polling) 방식 사용 금지
   - 서버에서 푸시

### 트레이드오프

**실시간성 우선 → 처리량 희생**
- 배치 방식: 10,000 msg/s 가능
- 실시간 방식: 1,000 msg/s 목표
- **선택**: 적은 데이터라도 즉시 처리

**메모리 사용량 증가**
- Redis에 최근 데이터 보관
- TTL로 자동 정리 필수

---

## 📚 참고 자료

### 실시간 처리 아키텍처
- [Datadog Streaming Platform](https://www.datadoghq.com/blog/engineering/streaming-platform-kafka-custom-abstractions/)
- [Kafka Streams Documentation](https://kafka.apache.org/documentation/streams/)

### 상용 서비스 실시간 알림
- Datadog: 1분 평가 주기, < 10초 알림
- New Relic: 실시간 윈도우 설정 가능
- Prometheus: Pull 모델 (15초~1분)

---

*최종 수정일: 2025-10-31*
*문서 버전: 2.0 (실시간 처리 중심)*