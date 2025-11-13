import { Injectable, Logger } from "@nestjs/common";
import { ErrorLogGateway } from "../gateway/error-log.gateway";
import type { LogEventDto } from "../../shared/apm/logs/dto/log-event.dto";

/**
 * Kafka에서 받은 에러 로그를 WebSocket으로 내보내는 도메인 서비스
 */
@Injectable()
export class ErrorLogStreamService {
  private readonly logger = new Logger(ErrorLogStreamService.name);

  constructor(private readonly gateway: ErrorLogGateway) {}

  /**
   * 유효성 검증이 끝난 DTO를 변환 후 게이트웨이에 전달한다.
   */
  broadcast(dto: LogEventDto): void {
    const payload = {
      timestamp: dto.timestamp ?? new Date().toISOString(),
      service_name: dto.service_name,
      environment: dto.environment,
      level: dto.level,
      message: dto.message,
      trace_id: dto.trace_id,
      span_id: dto.span_id,
      labels: dto.labels,
    };

    this.gateway.emitErrorLog(payload);
    this.logger.debug(
      `에러 로그를 WebSocket으로 전송했습니다. service=${dto.service_name} env=${dto.environment}`,
    );
  }
}
