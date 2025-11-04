const express = require("express");
const axios = require("axios");
const pino = require("pino");
const pinoHttp = require("pino-http");

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

app.listen(PORT, () => {
  logger.info({
    message: "server started",
  });
});
