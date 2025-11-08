import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
} from "class-validator";

export class ListHttpLogsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]+$/, { message: "method must be alphabetic" })
  method?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ""
      ? undefined
      : Number(value),
  )
  @IsInt()
  statusCode?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ""
      ? undefined
      : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
