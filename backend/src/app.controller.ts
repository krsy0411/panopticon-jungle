import { Body, Controller, Post, Req } from '@nestjs/common';

@Controller('logs')
export class AppController {

  @Post()
  ingest(@Body() payload: any, @Req() req: any) {
    console.log('[log] from', req.ip, JSON.stringify(payload));
    return { status: 'ok' };
  }
}
