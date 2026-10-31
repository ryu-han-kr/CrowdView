import type { CrowdResult } from "./types";

/** 홈 목록이 쓰는 혼잡도 칸만 (10/31 라이트하우스: 홈 HTML이 600KB — 장소 242곳의 갱신 시각·빈 시간대 배열까지 실려 있었다) */
export type HomeCrowd = Pick<
  CrowdResult,
  "score" | "open" | "trend" | "offSeason" | "opens" | "source" | "area" | "headcount" | "headcountRange" | "paxHour" | "peopleScope"
>;
export const homeCrowd = (c: CrowdResult): HomeCrowd => ({
  score: c.score,
  open: c.open,
  trend: c.trend,
  offSeason: c.offSeason,
  opens: c.opens,
  source: c.source,
  area: c.area,
  headcount: c.headcount,
  headcountRange: c.headcountRange,
  paxHour: c.paxHour,
  peopleScope: c.peopleScope,
});
