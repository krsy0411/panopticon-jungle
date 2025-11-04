import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { LogModule } from "./logs/logs.module";
import { MetricsModule } from "./metrics/metrics.module";
import { NotificationModule } from "./notification/notification.module";

@Module({
  imports: [LogModule, MetricsModule, NotificationModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
