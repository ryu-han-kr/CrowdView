// '이번 주말 한산한 곳' (경수님 10/31 '알리기' 5번: 인스타·스레드·네이버 블로그에 올릴 주간 카드).
// 사람들이 많이 찾는 곳(영어 질문형 페이지가 있는 곳 = CROWD_PAGES, 공항 빼고)의 토·일 하루 최대 혼잡 예측을 평균해 줄 세운다
import { inSeason, weekForecast } from "./crowd/model";
import { levelOf } from "./levels";
import { mailEnabled, sendMail } from "./mail";
import { SITE } from "./seo";
import { getSignals } from "./crowd/signals";
import { CROWD_PAGES } from "./crowd-pages";
import { PLACES } from "./places";
import type { Place } from "./types";
import { addDays, kst } from "./time";

export interface WeekendPick {
  place: Place;
  /** 토·일 하루 최대 혼잡 예측 평균 */
  score: number;
}

/** 다가오는 토요일(오늘이 토요일이면 오늘)과 일요일 */
export function upcomingWeekend(today = kst().date): [string, string] {
  const dow = new Date(`${today}T12:00:00+09:00`).getUTCDay();
  const sat = addDays(today, (6 - dow + 7) % 7);
  return [sat, addDays(sat, 1)];
}

export async function weekendPicks(today = kst().date): Promise<{ sat: string; sun: string; calm: WeekendPick[]; busy: WeekendPick[] }> {
  const [sat, sun] = upcomingWeekend(today);
  const places = CROWD_PAGES.filter((c) => c.kind === "place")
    .map((c) => PLACES.find((p) => p.id === c.id))
    // 철 지난 곳(가을 스키장·워터파크)은 '쾌적'으로 나와도 갈 수 없으니 뺀다
    .filter((p): p is Place => !!p && p.category !== "airport" && p.category !== "event" && inSeason(p, sat) && inSeason(p, sun));
  const scored = await Promise.all(
    places.map(async (place) => {
      const s = await getSignals(place).catch(() => undefined);
      const days = weekForecast(place, s, 2, sat);
      return { place, score: Math.round((days[0].peakScore + days[1].peakScore) / 2) };
    }),
  );
  const sorted = scored.sort((a, b) => a.score - b.score);
  return { sat, sun, calm: sorted.slice(0, 5), busy: sorted.slice(-3).reverse() };
}

export const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export async function weekendCaption(): Promise<string> {
  const { sat, sun, calm, busy } = await weekendPicks();
  const line = (p: WeekendPick) => `· ${p.place.name} (${levelOf(p.score).label})`;
  return [
    `이번 주말(${md(sat)}·${md(sun)}) 어디가 한산할까? 🧭`,
    "",
    "✅ 비교적 한산할 곳",
    ...calm.map(line),
    "",
    "⚠️ 붐빌 곳",
    ...busy.map(line),
    "",
    "AI 예측이라 당일 날씨·행사로 달라질 수 있어요. 지금 실제 혼잡도는 CrowdView에서 👉 crowdview.app",
    "",
    "#주말나들이 #주말여행 #가볼만한곳 #혼잡도 #놀이공원 #데이트코스 #CrowdView",
  ].join("\n");
}

/** 메일에 넣을 그림 주소 (w로 주마다 캐시를 새로) */
export const weekendCardUrl = (date = kst().date) => `${SITE}/api/weekend-card?w=${date}`;

/** 매주 목요일 새벽 (api/cron/refresh): 카드 그림 주소와 올릴 글을 경수님(REPORT_EMAIL_TO) 메일로. 보냈으면 1 */
export async function mailWeekendCard(): Promise<number> {
  const to = process.env.REPORT_EMAIL_TO;
  if (!to || !mailEnabled) return 0;
  const [sat] = upcomingWeekend();
  await sendMail({
    to,
    subject: `[CrowdView] 이번 주말(${md(sat)}) 한산한 곳 카드`,
    text: `그림(길게 눌러 저장): ${weekendCardUrl()}\n\n── 올릴 글 ──\n${await weekendCaption()}`,
  });
  return 1;
}
