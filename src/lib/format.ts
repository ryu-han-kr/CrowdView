import { DEFAULT_LANG, type Lang } from "../i18n/config";
import { compactNumber as compactI18n, makeT, type T } from "../i18n/translate";
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

/** 12,000 → 1.2만 (언어별: 1.2万 · 1.2萬 · 12K) */
export function compactNumber(n: number, lang: Lang = DEFAULT_LANG): string {
  return compactI18n(n, lang);
}

/**
 * 화면에 보여줄 인원.
 * - 서울시: 명소는 주변 지역 실측을 장소 크기로 줄인 추정(약 2.3만명), 행사장처럼 지역이 곧 장소면 범위 그대로 (6.6만~6.8만명)
 * - 인천공항: 출국장 대기 인원 실측
 * - 그 외(예측 모델, 한국공항공사 단계값): 수용 인원 × 혼잡도로 계산한 추정치. 라벨이 꺼져 있으면 숨긴다
 */
export function headcountInfo(
  c: CrowdResult,
  i18n: { t: T; lang: Lang } = { t: makeT(undefined), lang: DEFAULT_LANG },
): { text: string; kind?: DataKind } | null {
  const { t, lang } = i18n;
  const n = (v: number) => compactNumber(v, lang);
  if (!c.open) return null;
  if (c.source === "seoul-citydata") {
    // 명소 기준으로 줄인 인원 (주변 지역 실측은 상세 화면에 따로)
    if (c.area) return { text: t("약 {n}명", { n: n(c.headcount) }), kind: "추정" };
    return {
      text: c.headcountRange
        ? t("{min}~{max}명", { min: n(c.headcountRange[0]), max: n(c.headcountRange[1]) })
        : t("약 {n}명", { n: n(c.headcount) }),
    };
  }
  if (c.source === "incheon-airport") return { text: t("출국 수속 줄 {n}명", { n: c.headcount.toLocaleString() }) };
  if (c.source === "kac-airport" && c.paxHour) return { text: t("이번 시간 출발 {n}명", { n: c.headcount.toLocaleString() }) };
  // 부산 생활인구처럼 행정동 일대 값이면 '일대'를 붙인다 (해운대 해수욕장 1.6만 명 ≠ 백사장 인원, QA #11)
  if (c.peopleScope === "area") return { text: t("일대 약 {n}명", { n: n(c.headcount) }), kind: "추정" };
  return SHOW_DATA_LABELS ? { text: t("약 {n}명", { n: n(c.headcount) }), kind: "추정" } : null;
}
