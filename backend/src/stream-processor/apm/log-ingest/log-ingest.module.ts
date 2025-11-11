import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../../shared/apm/apm.module";
import { LogIngestService } from "./log-ingest.service";

@Module({
  imports: [ApmInfrastructureModule],
  providers: [LogIngestService],
  exports: [LogIngestService],
})
export class LogIngestModule {}
