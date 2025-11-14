/**
 * 더미 APM 데이터 생성 및 전송 스크립트
 * 11월 12일 00:00 ~ 15:00 시간대의 랜덤 데이터 생성
 */

const API_BASE_URL = 'http://localhost:3005/producer';
// 'http://panopticon-alb-2099783513.ap-northeast-2.elb.amazonaws.com/producer';

// 설정
const CONFIG = {
  START_TIME: new Date('2025-11-12T00:00:00+09:00'),
  END_TIME: new Date('2025-11-12T15:00:00+09:00'),
  TOTAL_SPANS: 1, // 생성할 span 개수
  TOTAL_LOGS: 1, // 생성할 log 개수
  BATCH_SIZE: 1, // 한 번에 보낼 개수
  DELAY_MS: 1, // 배치 간 딜레이 (ms)
};

const TOTAL = CONFIG.TOTAL_SPANS + CONFIG.TOTAL_LOGS;

// 샘플 데이터
const SERVICES = [
  'ecommerce-backend',
  'auth-service',
  'payment-service',
  'notification-service',
  'inventory-service',
  'user-service',
];

const ENVIRONMENTS = ['production', 'staging', 'development'];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const API_ENDPOINTS = [
  '/api/users',
  '/api/products',
  '/api/orders',
  '/api/payments',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/cart',
  '/api/checkout',
  '/api/inventory',
  '/api/notifications',
  '/api/search',
  '/api/recommendations',
];

const SPAN_NAMES = [
  'HTTP GET',
  'HTTP POST',
  'Database Query',
  'Redis Cache',
  'External API Call',
  'Message Queue Publish',
  'File Upload',
  'Image Processing',
  'Email Send',
  'Payment Processing',
];

const SPAN_KINDS = ['SERVER', 'CLIENT', 'INTERNAL'];

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

const LOG_MESSAGES = [
  'Request processed successfully',
  'Database connection established',
  'Cache hit for key',
  'User authentication successful',
  'Payment transaction completed',
  'Order created',
  'Email notification sent',
  'File uploaded to S3',
  'Redis cache updated',
  'API request received',
  'Validation error occurred',
  'Database query executed',
  'Rate limit exceeded',
  'Session expired',
  'Inventory updated',
];

// 유틸리티 함수
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateTraceId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

function generateSpanId(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

function randomTimestamp(start: Date, end: Date): string {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime).toISOString();
}

function generateHttpStatusCode(): number {
  const statuses = [200, 200, 200, 200, 201, 204, 400, 401, 403, 404, 500];
  return randomElement(statuses);
}

// Span 데이터 생성
function generateSpan(): any {
  const serviceName = randomElement(SERVICES);
  const environment = randomElement(ENVIRONMENTS);
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const timestamp = randomTimestamp(CONFIG.START_TIME, CONFIG.END_TIME);
  const hasParent = Math.random() > 0.3;

  const spanName = randomElement(SPAN_NAMES);
  const httpMethod = randomElement(HTTP_METHODS);
  const httpPath = randomElement(API_ENDPOINTS);

  const span: any = {
    type: 'span',
    timestamp,
    service_name: serviceName,
    environment,
    trace_id: traceId,
    span_id: spanId,
    parent_span_id: hasParent ? generateSpanId() : null,
    name: spanName.includes('HTTP') ? `${httpMethod} ${httpPath}` : spanName,
    kind: randomElement(SPAN_KINDS),
    duration_ms: randomFloat(1, 500, 2),
    status: Math.random() > 0.9 ? 'ERROR' : 'OK',
    labels: {
      component: randomElement(['http', 'database', 'cache', 'queue']),
      version: `v${randomInt(1, 3)}.${randomInt(0, 9)}.${randomInt(0, 20)}`,
    },
  };

  // HTTP 정보 추가 (80% 확률)
  if (Math.random() > 0.2) {
    span.http_method = randomElement(HTTP_METHODS);
    span.http_path = randomElement(API_ENDPOINTS);
    span.http_status_code = generateHttpStatusCode();
  }

  return span;
}

// Log 데이터 생성
function generateLog(): any {
  const serviceName = randomElement(SERVICES);
  const environment = randomElement(ENVIRONMENTS);
  const timestamp = randomTimestamp(CONFIG.START_TIME, CONFIG.END_TIME);
  const isHttpLog = Math.random() > 0.4; // 60% HTTP 로그

  const log: any = {
    type: 'log',
    timestamp,
    service_name: serviceName,
    environment,
    level: randomElement(LOG_LEVELS),
    message: randomElement(LOG_MESSAGES),
    labels: {
      host: `${serviceName}-${randomInt(1, 5)}`,
      pod_id: `pod-${randomInt(1000, 9999)}`,
    },
  };

  // HTTP 로그인 경우
  if (isHttpLog) {
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    log.trace_id = traceId;
    log.span_id = spanId;
    log.http_method = randomElement(HTTP_METHODS);
    log.http_path = randomElement(API_ENDPOINTS);
    log.http_status_code = generateHttpStatusCode();
  }

  return log;
}

// API 전송 함수
async function sendData(endpoint: string, data: any[]): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(
      `✅ Sent ${data.length} items to ${endpoint} (status: ${response.status})`,
    );
  } catch (error) {
    console.error(`❌ Failed to send to ${endpoint}:`, error);
  }
}

// 배치 전송
async function sendInBatches(
  endpoint: string,
  dataGenerator: () => any,
  total: number,
): Promise<void> {
  const batches = Math.ceil(total / CONFIG.BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(
      CONFIG.BATCH_SIZE,
      total - i * CONFIG.BATCH_SIZE,
    );
    const batch = Array.from({ length: batchSize }, dataGenerator);

    await sendData(endpoint, batch);

    // 딜레이
    if (i < batches - 1) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS));
    }
  }
}

// 메인 실행
async function main() {
  console.log('🚀 Starting dummy data generation...\n');
  console.log('Configuration:');
  console.log(`  API URL: ${API_BASE_URL}`);
  console.log(`  Time Range: ${CONFIG.START_TIME} ~ ${CONFIG.END_TIME}`);
  console.log(`  Total Spans: ${CONFIG.TOTAL_SPANS}`);
  console.log(`  Total Logs: ${CONFIG.TOTAL_LOGS}`);
  console.log(`  Batch Size: ${CONFIG.BATCH_SIZE}`);
  console.log();

  try {
    // Log 데이터 전송
    const start = Date.now();
    console.log('📝 Sending log data...');
    await sendInBatches('/v1/logs', generateLog, CONFIG.TOTAL_LOGS);
    console.log();

    // Span 데이터 전송
    console.log('📊 Sending span data...');
    await sendInBatches('/v1/httplogs', generateSpan, CONFIG.TOTAL_SPANS);
    console.log();

    console.log('✅ All data sent successfully!');
    console.log(
      `\nSummary: ${CONFIG.TOTAL_LOGS} logs + ${CONFIG.TOTAL_SPANS} spans = ${CONFIG.TOTAL_LOGS + CONFIG.TOTAL_SPANS} total records`,
    );

    const duration = (Date.now() - start) / 1000;
    console.log(`\n✅ Done in ${duration.toFixed(2)}s`);
    console.log(`Throughput: ${(TOTAL / duration).toFixed(2)} req/s`);

    // 메트릭 확인

    const metrics = await fetch(`${API_BASE_URL}/metrics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const metricsData = await metrics.json();
    console.log('Metrics:', JSON.stringify(metricsData, null, 2));
  } catch (error) {
    console.error('❌ Error during execution:', error);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}
