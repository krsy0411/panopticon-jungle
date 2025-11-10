import { Controller, Get } from "@nestjs/common";

@Controller()
export class QueryApiController {
    @Get('health')
    getHealth() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
