import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateLogDto {
  @ApiProperty({
    description: "로그 타임스탬프 (ISO 8601 형식)",
    example: "2025-11-04T10:30:00Z",
    required: false,
  })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiProperty({
    description: "서비스 이름",
    example: "user-api",
  })
  @IsString()
  @IsNotEmpty()
  service!: string;

  @ApiProperty({
    description: "로그 레벨",
    example: "ERROR",
    enum: ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
  })
  @IsString()
  @IsNotEmpty()
  level!: string;

  @ApiProperty({
    description: "로그 메시지",
    example: "Database connection timeout",
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
