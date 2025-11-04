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
