import { Module } from "@nestjs/common";
import { ApmInfrastructureModule } from "../../shared/apm/apm.module";
import { SpansController } from "./spans.controller";
import { SpanSearchService } from "./span-search.service";

@Module({
  imports: [ApmInfrastructureModule],
  controllers: [SpansController],
  providers: [SpanSearchService],
})
export class SpansModule {}
