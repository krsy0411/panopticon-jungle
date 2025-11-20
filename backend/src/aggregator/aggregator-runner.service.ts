import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { RollupConfigService } from "./rollup-config.service";
import { MinuteWindowPlanner } from "./window-planner.service";
import { SpanMinuteAggregationService } from "./span-minute-aggregation.service";
import { RollupMetricsRepository } from "./rollup-metrics.repository";
import { RollupCheckpointService } from "./rollup-checkpoint.service";

/**
 * 주기적으로 롤업 집계를 실행하는 메인 실행기
 */
@Injectable()
export class AggregatorRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AggregatorRunner.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: RollupConfigService,
    private readonly windowPlanner: MinuteWindowPlanner,
    private readonly spanAggregator: SpanMinuteAggregationService,
    private readonly rollupRepository: RollupMetricsRepository,
    private readonly checkpoint: RollupCheckpointService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.isEnabled()) {
      this.logger.warn(
        "ROLLUP_AGGREGATOR_ENABLED=false 이므로 롤업 작업을 시작하지 않습니다.",
      );
      return;
    }

    this.logger.log(
      `롤업 집계기가 활성화되었습니다. bucket=${this.config.getBucketDurationSeconds()}s interval=${this.config.getPollIntervalMs()}ms lookback=${this.config.getInitialLookbackMs() / 1000 / 60}m`,
    );
    await this.executeCycle();
    const interval = this.config.getPollIntervalMs();
    this.timer = setInterval(() => {
      void this.executeCycle().catch((error) => {
        this.logger.error(
          "롤업 주기 실행 중 처리되지 않은 오류가 발생했습니다.",
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, interval);
    this.logger.log(`롤업 집계 루프가 시작되었습니다. interval=${interval}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async executeCycle(): Promise<void> {
    if (this.running) {
      this.logger.warn(
        "이전 롤업 작업이 아직 진행 중이라 이번 주기를 건너뜁니다.",
      );
      return;
    }
    this.running = true;
    try {
      this.logger.log("롤업 집계 사이클을 시작합니다.");
      const windows = await this.windowPlanner.plan();
      if (windows.length === 0) {
        this.logger.log("집계 가능한 닫힌 분이 없어 이번 주기를 건너뜁니다.");
        return;
      }

      for (const window of windows) {
        const started = Date.now();
        try {
          const documents = await this.spanAggregator.aggregate(window);
          if (documents.length > 0) {
            await this.rollupRepository.bulkCreate(documents);
          }
          await this.checkpoint.saveCheckpoint(window.end);
          const elapsed = Date.now() - started;
          this.logger.log(
            `1분 롤업 완료 window=${window.start.toISOString()}~${window.end.toISOString()} docs=${documents.length} elapsed=${elapsed}ms`,
          );
        } catch (error) {
          this.logger.error(
            `윈도우 집계 중 오류가 발생했습니다. window=${window.start.toISOString()}~${window.end.toISOString()}`,
            error instanceof Error ? error.stack : String(error),
          );
          // 오류가 발생해도 다음 반복에서는 동일 윈도우부터 다시 시도할 수 있도록 바로 반환한다.
          return;
        }
      }
    } finally {
      this.running = false;
    }
  }
}
