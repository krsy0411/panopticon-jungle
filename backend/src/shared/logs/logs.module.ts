import { Global, Module } from "@nestjs/common";
import { LogStorageService } from "./log-storage.service";

/**
 * Elasticsearch 인프라 서비스를 전역으로 노출하는 모듈
 * - stream-processor / query-api 에서 모두 주입받아 사용
 */
@Global()
@Module({
  providers: [LogStorageService],
  exports: [LogStorageService],
})
export class LogInfrastructureModule {}
