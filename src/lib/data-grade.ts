// 자료 등급 (QA 10/21 정확도 개선): 같은 '혼잡' 이라도 어디서 온 값인지 한눈에.
// A 실측 = 기관이 센 인원·대기(서울시 지역, 공항 출국장) · B 실시간 추정 = 실시간 신호로 추정(놀이기구 대기, 지역 안 시설) · C 통계 예측 = 실시간 없음
import type { CrowdSnapshot } from "./types";

export type DataGrade = "A" | "B" | "C";

export function dataGrade(c: Pick<CrowdSnapshot, "source" | "area">): DataGrade {
  if (c.source === "model") return "C";
  if (c.source === "themeparks-wiki" || c.source === "queue-times" || c.area) return "B";
  return "A";
}

export const GRADE_LABEL: Record<DataGrade, string> = { A: "실측", B: "실시간 추정", C: "통계 예측" };
