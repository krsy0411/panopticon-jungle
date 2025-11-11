import type { SpanItemDto } from "../common/apm-response.types";

export interface SpanSearchResponseDto {
  total: number;
  page: number;
  size: number;
  items: SpanItemDto[];
}
