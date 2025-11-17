import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { BulkIngestModule } from "../../common/bulk-ingest.module";
import { LogIngestService } from "./log-ingest.service";

@Module({
  imports: [ApmInfrastructureModule, BulkIngestModule],
  providers: [LogIngestService],
  exports: [LogIngestService],
})
export class LogIngestModule {}
