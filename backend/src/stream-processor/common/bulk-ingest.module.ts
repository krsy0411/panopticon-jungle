import { Global, Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../shared/apm/apm.module";
import { BulkIndexerService } from "./bulk-indexer.service";

/**
 * Bulk 인덱싱 서비스를 전역으로 제공하는 모듈
 */
@Global()
@Module({
  imports: [ApmInfrastructureModule],
  providers: [BulkIndexerService],
  exports: [BulkIndexerService],
})
export class BulkIngestModule {}
