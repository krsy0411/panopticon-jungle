import axios from "axios";

// http 요청정보
interface HttpInfo {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  statusCode: number;
  duration: number; // 몇초 걸리는지
  requestSize: number;
  responseSize: number;
}

// 에러정보
interface ErrorInfo {
  type: string;
  message: string;
  stack: string;
  code: string;
}

/**
 * 시스템메트릭 정보 (cpu, memory)
 * 이부분은 현재 필요할지 잘 모르겠습니다.
 * 그리고 node 기준으로 시스템메트릭 접근 가능합니다.
 */
interface SystemMetrics {
  cpu: {
    // cpu 사용시간. 이건 활용방안 생각해봐야함
    user: number;
    system: number;
  };
  memory: {
    // 메모리 사용공간 추적
    heapUsed: number;
    heapTotal: number;
    heapUsedMB: string;
    heapTotalMB: string;
  };
  // 가동시간
  uptime: number;
}

// 로그 데이터 본체
interface LogData {
  timestamp: number;
  logId: string;
  serviceName: string;
  environment: "production" | "staging" | "development";
  http: HttpInfo;
  error?: ErrorInfo;
  system?: SystemMetrics;
}

interface TrafficConfig {
  totalLogs: number;
  concurrentRequests: number;
  serverUrl: string;
  errorRate: number; // 0-1 (에러 로그 비율)
  includeSystemMetrics: boolean;
  delayBetweenBatches: number; // ms (배치 간 딜레이)
}

// 더미데이터 보내기 설정
const CODE_CONFIG: TrafficConfig = {
  totalLogs: 1000, // 전송할 총 로그 개수
  concurrentRequests: 10, // 동시에 전송할 로그 수
  serverUrl: "http://localhost:3001/api/v1/logs", // 서버 URL
  errorRate: 0.1, // 에러 로그 비율 (0-1)
  includeSystemMetrics: false, // 시스템 메트릭 포함 여부
  delayBetweenBatches: 0, // 배치 간 딜레이 (밀리초, 0 = 딜레이 없음)
};

// UUID v4 생성 함수
// 이 부분도 id를 어떻게 받느냐에 따라서 달라집니다.
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 랜덤 데이터 생성 함수들
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateHttpInfo(): HttpInfo {
  const methods: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH"> = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
  ];
  const endpoints = [
    "/api/users",
    "/api/products",
    "/api/orders",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/payments",
    "/api/analytics",
  ];
  const statusCodes = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503];

  return {
    method: getRandomElement(methods),
    url: getRandomElement(endpoints),
    statusCode: getRandomElement(statusCodes),
    duration: getRandomInt(10, 500),
    requestSize: getRandomInt(100, 5000),
    responseSize: getRandomInt(200, 10000),
  };
}

function generateErrorInfo(): ErrorInfo {
  const errorTypes = [
    "ValidationError",
    "DatabaseError",
    "AuthenticationError",
    "NetworkError",
    "TimeoutError",
  ];
  const errorMessages = [
    "Invalid email format",
    "Connection timeout",
    "Unauthorized access",
    "Database query failed",
    "Resource not found",
  ];

  const type = getRandomElement(errorTypes);
  const message = getRandomElement(errorMessages);

  return {
    type,
    message,
    stack: `Error: ${message}\n  at Function.handler (/app/src/handler.js:42:15)\n  at processRequest (/app/src/server.js:120:8)`,
    code: `ERR_${getRandomInt(1000, 9999)}`,
  };
}

function generateSystemMetrics(): SystemMetrics {
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage();

  return {
    cpu: {
      user: cpuUsage.user + getRandomInt(-10000, 10000),
      system: cpuUsage.system + getRandomInt(-5000, 5000),
    },
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
    },
    uptime: Math.floor(process.uptime()) + getRandomInt(-100, 100),
  };
}

// 더미 로그 생성
function generateDummyLog(config: TrafficConfig): LogData {
  const serviceNames = [
    "user-service",
    "payment-service",
    "order-service",
    "auth-service",
    "notification-service",
  ];
  const environments: Array<"production" | "staging" | "development"> = [
    "production",
    "staging",
    "development",
  ];

  const log: LogData = {
    timestamp: Date.now(),
    logId: generateUUID(),
    serviceName: getRandomElement(serviceNames),
    environment: getRandomElement(environments),
    http: generateHttpInfo(),
  };

  // 에러 로그 포함 여부
  if (Math.random() < config.errorRate) {
    log.error = generateErrorInfo();
  }

  // 시스템 메트릭 포함 여부
  if (config.includeSystemMetrics) {
    log.system = generateSystemMetrics();
  }

  return log;
}

// 로그 전송 함수
async function sendLog(log: LogData, serverUrl: string): Promise<void> {
  try {
    await axios.post(serverUrl, log, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Failed to send log: ${error.message}`);
    } else {
      console.error(`Unknown error: ${error}`);
    }
  }
}

// === 배치 전송 (동시성 제어) ===
async function sendLogsInBatches(config: TrafficConfig): Promise<void> {
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  console.log("\n=== 더미 로그 전송 시작 ===");
  console.log(`서버 URL: ${config.serverUrl}`);
  console.log(`총 로그 수: ${config.totalLogs}`);
  console.log(`동시 요청 수: ${config.concurrentRequests}`);
  console.log(`배치 간 딜레이: ${config.delayBetweenBatches}ms`);
  console.log(`에러 로그 비율: ${(config.errorRate * 100).toFixed(0)}%`);
  console.log(
    `시스템 메트릭 포함: ${config.includeSystemMetrics ? "예" : "아니오"}`
  );
  console.log("========================\n");

  const totalBatches = Math.ceil(config.totalLogs / config.concurrentRequests);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const logsInThisBatch = Math.min(
      config.concurrentRequests,
      config.totalLogs - batchIndex * config.concurrentRequests
    );

    const promises: Promise<void>[] = [];

    for (let i = 0; i < logsInThisBatch; i++) {
      const log = generateDummyLog(config);
      promises.push(
        sendLog(log, config.serverUrl)
          .then(() => {
            successCount++;
          })
          .catch(() => {
            failCount++;
          })
      );
    }

    await Promise.all(promises);

    const progress = Math.floor(((batchIndex + 1) / totalBatches) * 100);
    console.log(
      `진행률: ${progress}% (${successCount + failCount}/${config.totalLogs})`
    );

    // 배치 간 딜레이 (마지막 배치 제외)
    if (config.delayBetweenBatches > 0 && batchIndex < totalBatches - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenBatches)
      );
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const logsPerSecond = (config.totalLogs / parseFloat(duration)).toFixed(2);

  console.log("\n=== 전송 완료 ===");
  console.log(`총 소요 시간: ${duration}초`);
  console.log(`성공: ${successCount}`);
  console.log(`실패: ${failCount}`);
  console.log(`초당 로그 수: ${logsPerSecond} logs/sec`);
  console.log("==================\n");
}

// === CLI 매개변수 파싱 ===
function parseArguments(): TrafficConfig {
  const args = process.argv.slice(2);

  const config: TrafficConfig = {
    totalLogs: 100,
    concurrentRequests: 10,
    serverUrl: "http://localhost:3000/api/logs",
    errorRate: 0.1,
    includeSystemMetrics: false,
    delayBetweenBatches: 0,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case "--total":
      case "-t":
        config.totalLogs = parseInt(value, 10);
        i++;
        break;
      case "--concurrent":
      case "-c":
        config.concurrentRequests = parseInt(value, 10);
        i++;
        break;
      case "--url":
      case "-u":
        config.serverUrl = value;
        i++;
        break;
      case "--error-rate":
      case "-e":
        config.errorRate = parseFloat(value);
        i++;
        break;
      case "--system-metrics":
      case "-s":
        config.includeSystemMetrics = true;
        break;
      case "--delay":
      case "-d":
        config.delayBetweenBatches = parseInt(value, 10);
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
더미 로그 전송 프로그램

사용법:
  npm start -- [옵션]

  ※ 옵션 없이 실행하면 코드 내 CODE_CONFIG 값을 사용합니다.

옵션:
  -t, --total <수>              전송할 총 로그 개수 (기본값: 100)
  -c, --concurrent <수>         동시 요청 수 (기본값: 10)
  -u, --url <URL>               서버 URL (기본값: http://localhost:3000/api/logs)
  -e, --error-rate <비율>       에러 로그 비율 0-1 (기본값: 0.1)
  -d, --delay <밀리초>          배치 간 딜레이 (기본값: 0)
  -s, --system-metrics          시스템 메트릭 포함
  -h, --help                    도움말 표시

예시:
  npm start                     # CODE_CONFIG 값 사용
  npm start -- -t 1000 -c 50 -d 1000 -u http://localhost:3000/api/logs
  npm start -- --total 500 --concurrent 20 --error-rate 0.2 --delay 2000 --system-metrics
  `);
}

async function checkServer(): Promise<boolean> {
  try {
    const response = await axios.get("http://localhost:3001/api/healthy", {
      timeout: 5000,
    });
    console.log(response + "ddd");
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// === 메인 실행 ===
async function main() {
  // CLI 인자가 없으면 CODE_CONFIG 사용, 있으면 parseArguments 사용
  const hasCliArgs = process.argv.slice(2).length > 0;
  const config = hasCliArgs ? parseArguments() : CODE_CONFIG;
  const isHealthy = await checkServer();
  if (!hasCliArgs) {
    console.log("💡 코드 내 CODE_CONFIG 설정을 사용합니다.");
    console.log("   CLI 옵션을 사용하려면: npm start -- --help\n");
  }
  // 서버가 수신이 안되면 바로 종료
  if (!isHealthy) {
    console.error("서버 응답 없음.");
    process.exit(1);
  }

  try {
    await sendLogsInBatches(config);
  } catch (error) {
    console.error("치명적 오류:", error);
    process.exit(1);
  }
}

main();
