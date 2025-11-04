import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListLogsQueryDto {
  @ApiPropertyOptional({
    description: "서비스 이름으로 필터링",
    example: "user-api",
  })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({
    description: "로그 레벨로 필터링",
    example: "ERROR",
    enum: ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: "조회할 로그 개수 (최대 500)",
    example: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
