import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("alb")
@Controller()
export class QueryApiController {
  @Get("health")
  @ApiOperation({
    summary: "ALB 헬스 체크",
    description:
      "ALB Target Group에서 사용되는 헬스 엔드포인트입니다. 인증이나 추가 파라미터가 필요하지 않으며, " +
      "요청 시점 기준 애플리케이션의 헬스 상태와 타임스탬프를 반환합니다.\n\n" +
      "**요청 예시**\n" +
      "`GET /health`",
  })
  @ApiOkResponse({
    description: "현재 Query API 인스턴스 상태",
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          example: "정상",
          description: "서비스 동작 상태 요약",
        },
        timestamp: {
          type: "string",
          format: "date-time",
          example: "2024-04-01T12:00:00.000Z",
          description: "서버에서 응답을 생성한 시점 (ISO8601)",
        },
      },
    },
  })
  getHealth() {
    return { status: "정상", timestamp: new Date().toISOString() };
  }
}
