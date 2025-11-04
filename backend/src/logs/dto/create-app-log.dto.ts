import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAppLogDto {
  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsString()
  @IsNotEmpty()
  service!: string;

  @IsString()
  @IsNotEmpty()
  level!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
