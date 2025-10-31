import { Body, Controller, Post } from "@nestjs/common";

@Controller("logs")
export class AppController {
  @Post()
  ingest(@Body() payload: any) {
    console.log("[log] from", JSON.stringify(payload));
  }
}
