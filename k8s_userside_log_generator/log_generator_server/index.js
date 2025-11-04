const express = require("express");
const axios = require("axios");
const pino = require("pino");
const pinoHttp = require("pino-http");
const os = require("os");

const app = express();
const PORT = 3000;

// Pino Logger 설정
const logger = pino({
  level: "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
  base: {
    service: process.env.SERVICE_NAME || "log-generator-server",
  },
});

// Middleware
app.use(express.json());
// app.use(pinoHttp({ logger }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET API - 사용자 정보 조회 (예시)
app.get("/api/users/:id", async (req, res) => {
  logger.info({
    message: "user fetch started",
  });

  res.json({
    success: true,
  });
});

// POST API - 사용자 생성 (예시)
app.post("/api/users", async (req, res) => {
  const startTime = Date.now();
  const { name, email } = req.body;

  logger.info({
    message: "user creation started",
    module: "UserAPI",
    action: "createUser",
    name,
    email,
  });

  // 간단한 응답 데이터
  const newUser = {
    id: Math.floor(Math.random() * 1000),
    name: name || "Anonymous",
    email: email || "anonymous@example.com",
    createdAt: new Date().toISOString(),
  };

  const latency = Date.now() - startTime;

  logger.info({
    message: "user creation completed",
    module: "UserAPI",
    action: "createUser",
    userId: newUser.id,
    latency,
  });

  res.status(201).json({
    success: true,
    data: newUser,
    latency: latency,
  });
});

app.get("/api/autolog", async (req, res) => {
  let count = 0;
  const interval = setInterval(() => {
    logger.info({
      message: "auto log message",
    });
    count++;
    if (count >= 10) {
      clearInterval(interval);
    }
  }, 1000);
  res.status(201).json({
    success: true,
  });
});

// ========== 성공 케이스 ==========

app.get("/api/success/fast", async (req, res) => {
  logger.info({ message: "fast request success" });
  res.status(200).json({ success: true, message: "Fast response" });
});

app.get("/api/success/slow", async (req, res) => {
  const delay = 1000 + Math.random() * 2000; // 1-3초
  logger.info({ message: "slow request started", delay });
  await new Promise(resolve => setTimeout(resolve, delay));
  logger.info({ message: "slow request completed", delay });
  res.status(200).json({ success: true, message: "Slow response", delay });
});

app.post("/api/success/created", async (req, res) => {
  logger.info({ message: "resource created", body: req.body });
  res.status(201).json({ success: true, id: Math.floor(Math.random() * 1000) });
});

// ========== 클라이언트 에러 (4xx) ==========

app.get("/api/error/400", async (req, res) => {
  logger.warn({ message: "bad request", path: "/api/error/400" });
  res.status(400).json({ success: false, error: "Bad Request" });
});

app.get("/api/error/401", async (req, res) => {
  logger.warn({ message: "unauthorized access attempt", path: "/api/error/401" });
  res.status(401).json({ success: false, error: "Unauthorized" });
});

app.get("/api/error/403", async (req, res) => {
  logger.warn({ message: "forbidden access attempt", path: "/api/error/403" });
  res.status(403).json({ success: false, error: "Forbidden" });
});

app.get("/api/error/404", async (req, res) => {
  logger.warn({ message: "resource not found", path: "/api/error/404" });
  res.status(404).json({ success: false, error: "Not Found" });
});

app.get("/api/error/422", async (req, res) => {
  logger.warn({ message: "validation failed", path: "/api/error/422" });
  res.status(422).json({ success: false, error: "Unprocessable Entity" });
});

app.get("/api/error/429", async (req, res) => {
  logger.warn({ message: "rate limit exceeded", path: "/api/error/429" });
  res.status(429).json({ success: false, error: "Too Many Requests" });
});

// ========== 서버 에러 (5xx) ==========

app.get("/api/error/500", async (req, res) => {
  logger.error({ message: "internal server error", path: "/api/error/500", stack: "Error stack trace..." });
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

app.get("/api/error/502", async (req, res) => {
  logger.error({ message: "bad gateway error", path: "/api/error/502" });
  res.status(502).json({ success: false, error: "Bad Gateway" });
});

app.get("/api/error/503", async (req, res) => {
  logger.error({ message: "service unavailable", path: "/api/error/503" });
  res.status(503).json({ success: false, error: "Service Unavailable" });
});

app.get("/api/error/504", async (req, res) => {
  logger.error({ message: "gateway timeout", path: "/api/error/504" });
  res.status(504).json({ success: false, error: "Gateway Timeout" });
});

// ========== 다양한 레이턴시 ==========

app.get("/api/latency/p50", async (req, res) => {
  const delay = 50 + Math.random() * 50; // 50-100ms
  await new Promise(resolve => setTimeout(resolve, delay));
  logger.info({ message: "p50 latency request", latency: delay });
  res.status(200).json({ success: true, latency: delay });
});

app.get("/api/latency/p95", async (req, res) => {
  const delay = 200 + Math.random() * 100; // 200-300ms
  await new Promise(resolve => setTimeout(resolve, delay));
  logger.info({ message: "p95 latency request", latency: delay });
  res.status(200).json({ success: true, latency: delay });
});

app.get("/api/latency/p99", async (req, res) => {
  const delay = 500 + Math.random() * 500; // 500-1000ms
  await new Promise(resolve => setTimeout(resolve, delay));
  logger.warn({ message: "p99 latency request (slow)", latency: delay });
  res.status(200).json({ success: true, latency: delay });
});

app.get("/api/latency/timeout", async (req, res) => {
  const delay = 5000 + Math.random() * 5000; // 5-10초
  await new Promise(resolve => setTimeout(resolve, delay));
  logger.error({ message: "timeout simulation", latency: delay });
  res.status(200).json({ success: true, latency: delay });
});

// ========== 무작위 상태 ==========

app.get("/api/random", async (req, res) => {
  const rand = Math.random();

  if (rand < 0.7) {
    // 70% 성공
    logger.info({ message: "random request success" });
    res.status(200).json({ success: true });
  } else if (rand < 0.85) {
    // 15% 클라이언트 에러
    logger.warn({ message: "random request client error" });
    res.status(400).json({ success: false, error: "Client Error" });
  } else {
    // 15% 서버 에러
    logger.error({ message: "random request server error" });
    res.status(500).json({ success: false, error: "Server Error" });
  }
});

// CPU 사용률 추적을 위한 변수
let lastCPUUsage = process.cpuUsage();
let lastMeasureTime = Date.now();

// CPU 사용률 계산 함수
function getCPUUsage() {
  const currentCPUUsage = process.cpuUsage(lastCPUUsage);
  const currentTime = Date.now();
  const timeDiff = currentTime - lastMeasureTime;

  // microseconds를 milliseconds로 변환
  const userCPU = currentCPUUsage.user / 1000;
  const systemCPU = currentCPUUsage.system / 1000;
  const totalCPU = userCPU + systemCPU;

  // CPU 사용률 (%)
  const cpuPercent = (totalCPU / timeDiff) * 100;

  // 다음 측정을 위해 업데이트
  lastCPUUsage = process.cpuUsage();
  lastMeasureTime = currentTime;

  return {
    cpuPercent: Math.min(cpuPercent, 100).toFixed(2), // 최대 100%
    userCPU: userCPU.toFixed(2),
    systemCPU: systemCPU.toFixed(2),
    totalCPU: totalCPU.toFixed(2),
  };
}

// 메모리 사용률 계산 함수
function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    processMemoryMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
    processMemoryTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
    systemMemoryUsedGB: (usedMemory / 1024 / 1024 / 1024).toFixed(2),
    systemMemoryTotalGB: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
    systemMemoryPercent: ((usedMemory / totalMemory) * 100).toFixed(2),
  };
}

app.listen(PORT, () => {
  const pod_name = `log-generator-${Math.floor(Math.random() * 1000)}`;
  // 10초마다 CPU 및 메모리 메트릭 로깅
  setInterval(() => {
    const cpuMetrics = getCPUUsage();
    const memoryMetrics = getMemoryUsage();

    logger.info({
      message: "resource metrics",
      metric_type: "cpu_memory",
      log_type: "metrics",
      cpu: {
        usage_percent: parseFloat(cpuMetrics.cpuPercent),
        user_ms: parseFloat(cpuMetrics.userCPU),
        system_ms: parseFloat(cpuMetrics.systemCPU),
        total_ms: parseFloat(cpuMetrics.totalCPU),
      },
      memory: {
        process_heap_used_mb: parseFloat(memoryMetrics.processMemoryMB),
        process_heap_total_mb: parseFloat(memoryMetrics.processMemoryTotalMB),
        system_used_gb: parseFloat(memoryMetrics.systemMemoryUsedGB),
        system_total_gb: parseFloat(memoryMetrics.systemMemoryTotalGB),
        system_percent: parseFloat(memoryMetrics.systemMemoryPercent),
      },
      pod_name,
      node_name: process.env.NODE_NAME || "log-generator",
    });
  }, 10000); // 10초마다
});
