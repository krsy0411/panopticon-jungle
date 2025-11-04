import { Transform } from "class-transformer";
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

const INTERVAL_PATTERN = /^[1-9]\d*(ms|s|m|h|d|w|M|y)$/;

export class HttpStatusCodeCountsQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : value,
  )
  @IsISO8601()
  start?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : value,
  )
  @IsISO8601()
  end?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : value,
  )
  @IsString()
  @Matches(INTERVAL_PATTERN, {
    message:
      "interval must be a positive integer followed by one of ms,s,m,h,d,w,M,y",
  })
  interval?: string;

}
