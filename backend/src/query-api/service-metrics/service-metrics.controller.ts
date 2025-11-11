import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ServiceMetricsService } from "./service-metrics.service";
import { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";
import type { MetricResponse } from "./service-metric.types";

@ApiTags("service-metrics")
@Controller("services")
export class ServiceMetricsController {
  constructor(private readonly serviceMetrics: ServiceMetricsService) {}

  @Get(":serviceName/metrics")
  async getMetrics(
    @Param("serviceName") serviceName: string,
    @Query() query: ServiceMetricsQueryDto,
  ): Promise<MetricResponse[]> {
    return this.serviceMetrics.getMetrics(serviceName, query);
  }
}
