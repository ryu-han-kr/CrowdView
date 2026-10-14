import type { CrowdResult } from "./types";

/** 12,000 → 1.2만, 9,500 → 9,500 */
function compact(n: number): string {
  if (n < 10_000) return n.toLocaleString();
  const man = n / 10_000;
  return `${Number.isInteger(man) ? man : man.toFixed(1)}만`;
}

/**
 * 화면에 보여줄 인원. 실제로 받은 숫자만 보여준다.
 * - 서울시: 범위로 주므로 범위 그대로 (예: 6.6만~6.8만명)
 * - 인천공항: 출국장 대기 인원 실측
 * - 그 외(예측 모델, 한국공항공사 단계값): 인원 정보가 없으므로 표시하지 않는다
 */
export function headcountText(c: CrowdResult): string | null {
  if (!c.open) return null;
  if (c.source === "seoul-citydata") {
    return c.headcountRange ? `${compact(c.headcountRange[0])}~${compact(c.headcountRange[1])}명` : `약 ${compact(c.headcount)}명`;
  }
  if (c.source === "incheon-airport") return `출국 대기 ${c.headcount.toLocaleString()}명`;
  return null;
}
