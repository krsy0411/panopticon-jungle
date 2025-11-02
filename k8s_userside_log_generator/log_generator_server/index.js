const express = require("express");
const axios = require("axios");
const morgan = require("morgan");

const app = express();
const PORT = 3000;

// 서버 고유 이름 (난수 생성)
const SERVER_NAME = `server-${Math.random().toString(36).substring(2, 9)}`;

// Middleware
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET API - 사용자 정보 조회 (예시)
app.get("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();

  // console.log(`[GET] /api/users/${id} - Request received`);

  // 간단한 응답 데이터
  const userData = {
    id: parseInt(id),
    name: `User ${id}`,
    email: `user${id}@example.com`,
    createdAt: new Date().toISOString(),
  };

  const latency = Date.now() - startTime;

  res.json({
    success: true,
    data: userData,
    latency: latency,
  });
});

// POST API - 사용자 생성 (예시)
app.post("/api/users", async (req, res) => {
  const startTime = Date.now();
  const { name, email } = req.body;

  // console.log("[POST] /api/users - Request received", { name, email });

  // 간단한 응답 데이터
  const newUser = {
    id: Math.floor(Math.random() * 1000),
    name: name || "Anonymous",
    email: email || "anonymous@example.com",
    createdAt: new Date().toISOString(),
  };

  const latency = Date.now() - startTime;

  res.status(201).json({
    success: true,
    data: newUser,
    latency: latency,
  });
});

app.get("/api/autolog", async (req, res) => {
  let count = 0;
  const interval = setInterval(() => {
    console.log(`[${new Date().toISOString()}] ${SERVER_NAME}`);
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
  console.log(`\n🚀 Log Generator Server is running on port ${PORT}`);
  console.log(`📛 Server Name: ${SERVER_NAME}\n`);
});
