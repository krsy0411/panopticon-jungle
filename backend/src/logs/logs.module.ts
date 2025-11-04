import { Global, Module } from "@nestjs/common";
import { LogStorageService } from "./log-storage.service";

@Global()
@Module({
  providers: [LogStorageService],
  exports: [LogStorageService],
})
export class LogInfrastructureModule {}
