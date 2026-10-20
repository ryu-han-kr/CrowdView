// 한국관광공사 TourAPI 소개 정보(detailIntro2)로 운영 시간·휴무일·행사 일정을 실제 값으로 바꾼다.
// 하루 1번만 호출(Data Cache)하고, 실패하거나 정보가 없으면 places.ts의 값(임의)을 그대로 쓴다.
import { dataGoKr } from "./datagokr";
import { PLACES, getPlace } from "./places";
import { kst } from "./time";
import type { Place } from "./types";


const DAY = 24 * 60 * 60;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

const toHour = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
};

/** "6월~9월", "1월~2월/11월~12월" 이 오늘 달을 포함하는지 */
function monthMatches(label: string, month: number): boolean | null {
  const ranges = [...label.matchAll(/(\d{1,2})월\s*~\s*(\d{1,2})월/g)];
  if (!ranges.length) return null;
  return ranges.some(([, a, b]) => {
    const [from, to] = [Number(a), Number(b)];
    return from <= to ? month >= from && month <= to : month >= from || month <= to;
  });
}

/** "월요일~목요일/일요일", "평일", "주말", "토요일" 이 오늘 요일을 포함하는지 */
function dayMatches(label: string, day: number): boolean | null {
  if (/평일/.test(label)) return day >= 1 && day <= 5;
  if (/주말/.test(label)) return day === 0 || day === 6;
  const names = WEEKDAYS.map((w) => `${w}요일`);
  let found = false;
  let hit = false;
  for (const part of label.split("/")) {
    const range = part.match(/([일월화수목금토])요일\s*~\s*([일월화수목금토])요일/);
    if (range) {
      found = true;
      const [a, b] = [WEEKDAYS.indexOf(range[1]), WEEKDAYS.indexOf(range[2])];
      if (a <= b ? day >= a && day <= b : day >= a || day <= b) hit = true;
      continue;
    }
    for (const [i, n] of names.entries()) {
      if (part.includes(n)) {
        found = true;
        if (i === day) hit = true;
      }
    }
  }
  return found ? hit : null;
}

/**
 * 이용 시간 원문에서 오늘 적용되는 [여는 시각, 닫는 시각]을 찾는다.
 * 예) "[1월~2월/11월~12월]09:00~17:00 [3월~5월/9월~10월]09:00~18:00" → 10월이면 [9, 18]
 *     "[월요일~목요일/일요일]- 10:00~21:00 [금요일~토요일]- 10:00~22:00" → 금요일이면 [10, 22]
 */
export function parseTodayHours(text: string, date = kst().date): [number, number] | null {
  const month = Number(date.slice(5, 7));
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const times = [...text.matchAll(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/g)];
  if (!times.length) return null;
  let fallback: [number, number] | null = null;
  for (const t of times) {
    // 시간 바로 앞 구간(직전 시간 이후 ~ 이 시간 전)이 이 시간의 조건(라벨)
    const prevEnd = times[times.indexOf(t) - 1]?.index ?? -1;
    const label = text.slice(prevEnd < 0 ? 0 : prevEnd + times[times.indexOf(t) - 1][0].length, t.index);
    const range: [number, number] = [toHour(t[1]), toHour(t[2])];
    const m = monthMatches(label, month);
    const d = dayMatches(label, day);
    if (m === false || d === false) continue;
    if (m || d) return range;
    fallback ??= range;
  }
  // 조건이 붙은 시간만 있는데 오늘은 해당 없음 (예: 해수욕장 6~9월) → 모름
  return fallback;
}

export function closedToday(rest: string, date = kst().date): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return new RegExp(`매주\\s*${WEEKDAYS[day]}요일`).test(rest);
}

const ymdToDate = (s: unknown) => {
  const v = String(s ?? "");
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : undefined;
};

/** TourAPI 정보를 반영한 장소. 운영 시간·행사 일정을 실제 값으로 덮어쓴다 */
async function withInfo(place: Place): Promise<Place> {
  if (!place.ktoContent) return place;
  try {
    const [it] = await dataGoKr(
      "/B551011/KorService2/detailIntro2",
      {
        contentId: String(place.ktoContent.id),
        contentTypeId: String(place.ktoContent.type),
        MobileOS: "WEB",
        MobileApp: "CrowdView",
        _type: "json",
      },
      DAY,
    );
    if (!it) return place;

    if (place.ktoContent.type === 15) {
      let start = ymdToDate(it.eventstartdate);
      let end = ymdToDate(it.eventenddate);
      if (!start) return place;
      end ??= start;
      const today = kst().date;
      // 지난 회차만 올라와 있으면 같은 날짜로 내년을 추정
      const verified = end >= today;
      if (!verified) {
        const shift = (d: string) => `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;
        start = shift(start);
        end = shift(end);
      }
      const playtime = clean(it.playtime);
      const hours = parseTodayHours(playtime, start);
      return {
        ...place,
        eventDate: start,
        eventEndDate: end,
        hours: hours ?? place.hours,
        info: { hoursVerified: !!hours, eventVerified: verified, eventPlayTime: playtime || undefined },
      };
    }

    const hoursText = clean(it.usetime ?? it.usetimeleports ?? it.usetimeculture);
    const restText = clean(it.restdate ?? it.restdateleports ?? it.restdateculture);
    const hours = hoursText ? parseTodayHours(hoursText) : null;
    return {
      ...place,
      hours: hours ?? place.hours,
      info: {
        hoursText: hoursText || undefined,
        restText: restText || undefined,
        infocenter: clean(it.infocenter ?? it.infocenterleports) || undefined,
        hoursVerified: !!hours,
        closedToday: restText ? closedToday(restText) : undefined,
      },
    };
  } catch (e) {
    console.warn(`[place-info] ${place.id}:`, e instanceof Error ? e.message : e);
    return place;
  }
}

/** 모든 장소 (TourAPI 반영). Data Cache 덕에 하루 1번만 실제로 호출된다 */
export async function getLivePlaces(): Promise<Place[]> {
  if (!process.env.DATA_GO_KR_KEY) return PLACES;
  return Promise.all(PLACES.map(withInfo));
}

export async function getLivePlace(id: string): Promise<Place | undefined> {
  const place = getPlace(id);
  if (!place || !process.env.DATA_GO_KR_KEY) return place;
  return withInfo(place);
}

/** 행사가 아직 끝나지 않았는지 (진행 중 포함) */
export const isUpcomingEvent = (p: Place, today = kst().date) => !!p.eventDate && (p.eventEndDate ?? p.eventDate) >= today;

/** 행사 진행 중 여부 */
export const isOngoingEvent = (p: Place, today = kst().date) =>
  !!p.eventDate && p.eventDate <= today && (p.eventEndDate ?? p.eventDate) >= today;

