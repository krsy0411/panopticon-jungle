import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class ErrorStreamController {
  /**
   * ALB/모니터링용 헬스 체크 엔드포인트
   */
  @Get("health")
  @ApiOperation({
    summary: "Error Stream 헬스 체크",
    description:
      "Error Stream 서버 상태를 확인하는 단순 헬스 엔드포인트입니다. " +
      "WebSocket과 Kafka 소비 루프가 같은 프로세스에서 구동되므로, " +
      "이 HTTP 응답이 정상이라면 인스턴스 기초 상태가 정상임을 의미합니다.",
  })
  @ApiOkResponse({
    description: "현재 Error Stream 인스턴스 상태",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "정상" },
        timestamp: {
          type: "string",
          format: "date-time",
          example: "2024-04-01T12:00:00.000Z",
        },
      },
    },
  })
  getHealth() {
    return { status: "정상", timestamp: new Date().toISOString() };
  }
}
