// 웹 조사로 모은 장소별 혼잡 정보 (lib/place-research → 가공해 src/data/korea/place-research.json, 10/31 43곳).
// 연간 방문객(연도·출처)·붐비는/한산한 달·요일·시간·대기 메모·팁·혼잡 원인. 언론·통계·후기에서 모은 '알려진 경향'이라 실측과 따로 보여 준다
import data from "../data/korea/place-research.json";
import type { Place } from "./types";

export type ResearchDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "holiday";

export interface ResearchFacts {
  /** 연간 방문객 (최근 해 먼저): 해·인원·출처 */
  vis?: { y: number; n: number; s: string }[];
  pm?: number[];
  qm?: number[];
  bd?: ResearchDay[];
  qd?: ResearchDay[];
  /** 붐비는·한산한 시간 [시작시, 끝시] */
  bh?: [number, number][];
  qh?: [number, number][];
  wait?: string[];
  tips?: string[];
  trig?: string[];
  src?: string[];
  at?: string;
}

const FACTS = data as unknown as Record<string, ResearchFacts>;

export const researchOf = (id: string): ResearchFacts | undefined => FACTS[id];

/** 실측 원천이 없는 장소만: 붐비는 시간이 한 구간(6시간 이하)으로 좁게 알려졌으면 그 가운데를 피크 시각으로 */
export function researchPeak(p: Place, f = FACTS[p.id]): number | undefined {
  if (p.seoulArea || p.airport || p.themeparksId || p.queueTimesId || p.eventDate) return undefined;
  const w = f?.bh;
  if (w?.length !== 1) return undefined;
  const [a, b] = w[0];
  if (b - a > 6 || b <= p.hours[0] || a >= p.hours[1]) return undefined;
  return (Math.max(a, p.hours[0]) + Math.min(b, p.hours[1])) / 2;
}
