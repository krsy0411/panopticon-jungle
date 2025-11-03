import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { LogModule } from "./logs/logs.module";

@Module({
  imports: [LogModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
