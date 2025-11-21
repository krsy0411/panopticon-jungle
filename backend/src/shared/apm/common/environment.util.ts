/**
 * 환경 문자열을 공통 규칙에 맞춰 정규화한다.
 * - 사용자 입력은 대소문자/별칭(prod, production 등)을 허용한다.
 */
export function normalizeEnvironmentFilter(
  environment?: string,
): string | undefined {
  if (!environment) {
    return undefined;
  }
  const trimmed = environment.trim();
  if (!trimmed) {
    return undefined;
  }

  const key = trimmed.toLowerCase();
  const alias: Record<string, string> = {
    prod: "production",
    production: "production",
    dev: "development",
    development: "development",
    stage: "staging",
    staging: "staging",
    qa: "qa",
    test: "test",
  };

  return alias[key] ?? trimmed;
}
