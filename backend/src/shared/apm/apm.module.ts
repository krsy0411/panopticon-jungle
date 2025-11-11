import { Global, Module } from "@nestjs/common";
import { LogInfrastructureModule } from "../logs/logs.module";
import { ApmLogRepository } from "./logs/log.repository";
import { SpanRepository } from "./spans/span.repository";

@Global()
@Module({
  imports: [LogInfrastructureModule],
  providers: [ApmLogRepository, SpanRepository],
  exports: [ApmLogRepository, SpanRepository],
})
export class ApmInfrastructureModule {}
