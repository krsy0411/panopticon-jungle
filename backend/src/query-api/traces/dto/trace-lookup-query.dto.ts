import { IsOptional, IsString } from "class-validator";

/**
 * 단일 트레이스 조회 시 사용할 선택 파라미터
 */
export class TraceLookupQueryDto {
  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  service?: string;
}
