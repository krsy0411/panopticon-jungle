import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppLogModule } from "./logs/app/app-log.module";
import { HttpLogModule } from "./logs/http/http-log.module";
import { LogInfrastructureModule } from "./logs/logs.module";
import { MetricsModule } from "./metrics/metrics.module";

@Module({
  imports: [
    LogInfrastructureModule,
    AppLogModule,
    HttpLogModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
