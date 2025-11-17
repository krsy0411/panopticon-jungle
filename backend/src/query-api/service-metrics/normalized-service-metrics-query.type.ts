import type { ServiceMetricsQueryDto } from "./dto/service-metrics-query.dto";

/**
 * 서비스 메트릭 조회를 캐시/ES 단계 모두에서 동일하게 다루기 위한 정규화 결과
 */
export interface NormalizedServiceMetricsQuery {
  serviceName: string;
  environment?: string;
  metric?: ServiceMetricsQueryDto["metric"];
  from: string;
  to: string;
  interval: string;
  /**
   * from/to가 서버 기본 윈도우에서 유래했는지 여부 (캐시 사용 여부 판단에 활용)
   */
  isSlidingWindow: boolean;
  /**
   * 캐시를 적용해도 되는지 여부. 향후 롤업 등 정책을 고려해 별도 플래그로 둔다.
   */
  shouldUseCache: boolean;
  /**
   * 환경/엔드포인트 등 부가 필터를 사전순으로 정리한 문자열
   */
  cacheFilterSignature: string;
}
