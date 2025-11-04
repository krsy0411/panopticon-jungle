import { Logger } from "@nestjs/common";
import type { LogStreamKey } from "./log-storage.service";
import { LogStorageService } from "./log-storage.service";

export interface BaseLogDocument {
  "@timestamp": string;
  ingestedAt: string;
}

export type LogSearchResult<TDocument extends BaseLogDocument> = TDocument & {
  id: string;
};

export abstract class BaseLogRepository<TDocument extends BaseLogDocument> {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    private readonly storage: LogStorageService,
    private readonly streamKey: LogStreamKey,
  ) {}

  protected get client() {
    return this.storage.getClient();
  }

  protected get dataStream() {
    return this.storage.getDataStream(this.streamKey);
  }

  async save(document: TDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.dataStream,
        document,
      });
    } catch (error) {
      this.logger.error(
        "Failed to index log",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
