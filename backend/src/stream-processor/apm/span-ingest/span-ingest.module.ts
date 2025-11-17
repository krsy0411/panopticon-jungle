import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { BulkIngestModule } from "../../common/bulk-ingest.module";
import { SpanIngestService } from "./span-ingest.service";

@Module({
  imports: [ApmInfrastructureModule, BulkIngestModule],
  providers: [SpanIngestService],
  exports: [SpanIngestService],
})
export class SpanIngestModule {}
