import type { LogItemDto } from "../common/apm-response.types";

export interface LogSearchResponseDto {
  total: number;
  page: number;
  size: number;
  items: LogItemDto[];
}
