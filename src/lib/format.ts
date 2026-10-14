import type { CrowdResult } from "./types";

/**
 * 테스트 기간 동안 실데이터가 아닌 값 옆에 (추정)·(임의)를 붙인다.
 * 출시 때 NEXT_PUBLIC_DATA_LABELS=off 로 끄면 추정 인원도 함께 숨겨진다.
 * - 추정: 예측 모델이나 계산으로 만든 값 (더 정확한 데이터 소스가 필요)
 * - 임의: 사람이 직접 넣은 샘플 값 (공식 정보로 바꿔야 함)
 */
export const SHOW_DATA_LABELS = process.env.NEXT_PUBLIC_DATA_LABELS !== "off";

export type DataKind = "추정" | "임의";

/** 혼잡도 자체가 예측 모델 값인지 */
export const isEstimated = (c: CrowdResult) => c.source === "model";

/** 12,000 → 1.2만, 9,500 → 9,500 */
function compact(n: number): string {
  if (n < 10_000) return n.toLocaleString();
  const man = n / 10_000;
  return `${Number.isInteger(man) ? man : man.toFixed(1)}만`;
}

/**
 * 화면에 보여줄 인원.
 * - 서울시: 범위로 주므로 범위 그대로 (예: 6.6만~6.8만명)
 * - 인천공항: 출국장 대기 인원 실측
 * - 그 외(예측 모델, 한국공항공사 단계값): 수용 인원 × 혼잡도로 계산한 추정치. 라벨이 꺼져 있으면 숨긴다
 */
export function headcountInfo(c: CrowdResult): { text: string; kind?: DataKind } | null {
  if (!c.open) return null;
  if (c.source === "seoul-citydata") {
    return {
      text: c.headcountRange ? `${compact(c.headcountRange[0])}~${compact(c.headcountRange[1])}명` : `약 ${compact(c.headcount)}명`,
    };
  }
  if (c.source === "incheon-airport") return { text: `출국 대기 ${c.headcount.toLocaleString()}명` };
  return SHOW_DATA_LABELS ? { text: `약 ${compact(c.headcount)}명`, kind: "추정" } : null;
}
