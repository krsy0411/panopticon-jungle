import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { SpanIngestService } from "./span-ingest.service";

@Module({
  imports: [ApmInfrastructureModule],
  providers: [SpanIngestService],
  exports: [SpanIngestService],
})
export class SpanIngestModule {}
