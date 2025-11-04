import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppLogModule } from "./logs/app/app-log.module";
import { HttpLogModule } from "./logs/http/http-log.module";
import { LogInfrastructureModule } from "./logs/logs.module";

@Module({
  imports: [LogInfrastructureModule, AppLogModule, HttpLogModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
