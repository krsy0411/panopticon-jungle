/// <reference types="node" />
import process from "process";
import { io } from "socket.io-client";

const serverUrl = process.env.ERROR_STREAM_WS_URL ?? "ws://localhost:3010";
// const serverUrl = process.env.ERROR_STREAM_WS_URL ?? "https://api.jungle-panopticon.cloud";
const wsPath = process.env.ERROR_STREAM_WS_PATH ?? "/ws/error-logs";

console.log(
  `🔌 Error Stream WebSocket 테스트를 시작합니다. url=${serverUrl} path=${wsPath}`,
);

const socket = io(serverUrl, {
  path: wsPath,
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log(`✅ WebSocket 연결에 성공했습니다. socketId=${socket.id}`);
});

socket.on("error-log", (payload) => {
  console.log("📥 에러 로그 수신:", JSON.stringify(payload, null, 2));
});

socket.on("disconnect", (reason) => {
  console.log(`⚠️ WebSocket 연결이 종료되었습니다. reason=${reason}`);
});

socket.on("connect_error", (error) => {
  console.error("❌ WebSocket 연결 중 오류가 발생했습니다.", error);
});

process.on("SIGINT", () => {
  console.log("🛑 테스트 클라이언트를 종료합니다.");
  socket.close();
  process.exit(0);
});
