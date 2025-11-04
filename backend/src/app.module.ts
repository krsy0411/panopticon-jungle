import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppLogModule } from "./logs/app/app-log.module";
import { HttpLogModule } from "./logs/http/http-log.module";
import { LogInfrastructureModule } from "./logs/logs.module";
import { MetricsModule } from "./metrics/metrics.module";
import { NotificationModule } from "./notification/notification.module";

@Module({
  imports: [
    NotificationModule,
    LogInfrastructureModule,
    AppLogModule,
    HttpLogModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
