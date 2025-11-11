import { Controller, Get } from "@nestjs/common";

@Controller()
export class QueryApiController {
  @Get("health")
  getHealth() {
    return { status: "정상", timestamp: new Date().toISOString() };
  }
}
