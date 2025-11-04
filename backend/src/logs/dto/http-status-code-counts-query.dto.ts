import { Transform } from "class-transformer";
import { IsISO8601, IsOptional, IsString, Matches } from "class-validator";

const INTERVAL_PATTERN = /^[1-9]\d*(ms|s|m|h|d|w|M|y)$/;

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const stringValue = value.trim();
  return stringValue.length === 0 ? undefined : stringValue;
};

export class HttpStatusCodeCountsQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsISO8601()
  start?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsISO8601()
  end?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @Matches(INTERVAL_PATTERN, {
    message:
      "interval must be a positive integer followed by one of ms,s,m,h,d,w,M,y",
  })
  interval?: string;
}
