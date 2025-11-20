import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Client } from "@elastic/elasticsearch";
import { errors } from "@elastic/elasticsearch";
import { LogStorageService } from "../shared/logs/log-storage.service";
import { RollupConfigService } from "./rollup-config.service";

interface CheckpointDocument {
  lastRolledUpAt: string;
  updatedAt: string;
}

/**
 * 마지막으로 롤업을 완료한 분(minute)을 보관하는 저장소
 * - 데이터가 없는 분도 건너뛰어야 하므로 전용 인덱스로 상태를 관리한다.
 */
@Injectable()
export class RollupCheckpointService implements OnModuleInit {
  private readonly logger = new Logger(RollupCheckpointService.name);
  private readonly client: Client;
  private readonly indexName: string;
  private readonly checkpointId = "default-rollup-checkpoint";

  constructor(
    private readonly storage: LogStorageService,
    private readonly config: RollupConfigService,
  ) {
    this.client = storage.getClient();
    this.indexName = config.getCheckpointIndex();
  }

  async onModuleInit(): Promise<void> {
    await this.ensureIndex();
  }

  /**
   * 마지막으로 완료한 분(minute)의 끝 시각을 반환한다.
   */
  async loadLastCheckpoint(): Promise<Date | null> {
    try {
      const response = await this.client.get<CheckpointDocument>({
        index: this.indexName,
        id: this.checkpointId,
      });
      const iso = response._source?.lastRolledUpAt;
      return iso ? new Date(iso) : null;
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        return null;
      }
      this.logger.error(
        "롤업 체크포인트를 읽는 중 오류가 발생했습니다.",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 특정 분 구간을 처리한 뒤 체크포인트를 갱신한다.
   */
  async saveCheckpoint(windowEnd: Date): Promise<void> {
    await this.client.index({
      index: this.indexName,
      id: this.checkpointId,
      document: {
        lastRolledUpAt: windowEnd.toISOString(),
        updatedAt: new Date().toISOString(),
      },
      refresh: "wait_for",
    });
  }

  private async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (exists) {
      return;
    }

    this.logger.log(
      `롤업 체크포인트 인덱스를 생성합니다. index=${this.indexName}`,
    );
    await this.client.indices.create({
      index: this.indexName,
      mappings: {
        properties: {
          lastRolledUpAt: { type: "date" },
          updatedAt: { type: "date" },
        },
      },
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
    });
  }
}
