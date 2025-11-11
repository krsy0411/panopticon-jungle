export interface TimeRange {
  from: string;
  to: string;
}

/**
 * ISO8601 문자열을 안전하게 반환하기 위한 헬퍼
 */
function toIsoString(value: Date): string {
  return value.toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * 쿼리 파라미터로 전달된 from/to 값을 검사하고,
 * 없을 경우 기본 분(minute) 만큼 이전 시각을 from 으로 사용한다.
 */
export function resolveTimeRange(
  from?: string,
  to?: string,
  fallbackMinutes = 15,
): TimeRange {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : addMinutes(toDate, -fallbackMinutes);

  return {
    from: toIsoString(fromDate),
    to: toIsoString(toDate),
  };
}
