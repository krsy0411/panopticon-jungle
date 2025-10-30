import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    ingest(payload: any, req: any): {
        status: string;
    };
}
