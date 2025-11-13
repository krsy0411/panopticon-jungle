import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

interface ErrorLogPayload {
  timestamp: string;
  service_name: string;
  environment: string;
  level: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  labels?: Record<string, unknown>;
}

function resolveOrigins(): string[] | boolean {
  const raw = process.env.ERROR_STREAM_WS_ORIGINS;
  if (!raw || raw.trim().length === 0) {
    return true;
  }

  const origins = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : true;
}

@WebSocketGateway({
  cors: {
    origin: resolveOrigins(),
    credentials: false,
  },
  path: process.env.ERROR_STREAM_WS_PATH ?? "/ws/error-logs",
})
export class ErrorLogGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(ErrorLogGateway.name);

  onModuleInit(): void {
    this.logger.log("에러 로그 WebSocket 게이트웨이가 초기화되었습니다.");
  }

  onModuleDestroy(): void {
    this.logger.log("에러 로그 WebSocket 게이트웨이가 종료됩니다.");
  }

  handleConnection(client: Socket): void {
    this.logger.log(
      `프론트엔드 클라이언트가 연결되었습니다. id=${client.id} ip=${client.handshake.address}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(
      `프론트엔드 클라이언트 연결이 종료되었습니다. id=${client.id}`,
    );
  }

  /**
   * Kafka에서 수신한 에러 로그를 모든 구독자에게 push한다.
   */
  emitErrorLog(payload: ErrorLogPayload): void {
    if (!this.server) {
      this.logger.warn("WebSocket 서버가 초기화되지 않아 메시지를 보낼 수 없습니다.");
      return;
    }
    this.server.emit("error-log", payload);
  }
}
