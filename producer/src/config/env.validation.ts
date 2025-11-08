import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  MSK_BROKERS: string;

  @IsString()
  @IsNotEmpty()
  S3_BUCKET: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['ap-northeast-2', 'us-east-1', 'us-west-2', 'eu-west-1'], {
    message: 'AWS_REGION must be a valid AWS region',
  })
  AWS_REGION: string;

  @IsString()
  MSK_TOPIC?: string = 'panopticon-logs';

  @IsString()
  S3_PREFIX?: string = 'raw';

  // AWS 자격증명 (선택적 - 환경에 따라 IAM Role 또는 명시적 자격증명 사용)
  // @IsString()
  // AWS_ACCOUNT_ID?: string;

  // @IsString()
  // AWS_ACCESS_KEY_ID?: string;

  // @IsString()
  // AWS_SECRET_ACCESS_KEY?: string;

  // @IsString()
  // AWS_SESSION_TOKEN?: string;
}

export function validate(config: Record<string, unknown>) {
  // 1. process.env (plain object)를 클래스   인스턴스로 변환
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "3000"→ 3000 자동 변환
  });

  // 2. class-validator 데코레이터 기반 검증 실행
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false, // 필수 필드 누락 시 에러
  });

  // 3. 검증 실패 시 앱 시작 자체를 막음 (Fail-Fast)
  if (errors.length > 0) {
    throw new Error(/* 에러 메시지 */);
  }

  return validatedConfig;
}
