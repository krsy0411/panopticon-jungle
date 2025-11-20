/**
 * 1분 단위 롤업 작업 대상 구간을 표현하는 타입
 * - start 는 포함(inclusive), end 는 제외(exclusive)
 */
export interface MinuteWindow {
  start: Date;
  end: Date;
}
