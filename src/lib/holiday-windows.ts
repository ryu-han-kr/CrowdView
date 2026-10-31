// 다가오는 연휴 (경수님 10/31 '알리기' 7번: 설·연말 연휴 공항 검색이 몰리기 전에 예측을 먼저 띄운다).
// 공휴일(천문연구원 3개월 + 고정 공휴일·설·추석 표) → 주말과 붙은 쉬는 날 묶음 + 그 전날(출국이 몰리는 날)
import { lunarDay } from "./kr-days";
import { addDays } from "./time";

export interface HolidayWindow {
  /** 화면 이름 (한국어 원문, t()로 번역) */
  name: string;
  /** 전날부터 마지막 쉬는 날까지 */
  days: string[];
}

const FIXED: Record<string, string> = {
  "01-01": "새해",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "크리스마스",
};

/** 날짜 → 연휴 이름. known은 천문연구원 공휴일(대체공휴일 포함) */
export function holidayNames(from: string, days: number, known?: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [d] of known ?? []) out.set(d, "공휴일");
  const y0 = Number(from.slice(0, 4));
  for (let i = 0; i <= days; i++) {
    const d = addDays(from, i);
    if (FIXED[d.slice(5)]) out.set(d, FIXED[d.slice(5)]);
  }
  for (const y of [y0, y0 + 1]) {
    for (const [kind, name] of [["seollal", "설"], ["chuseok", "추석"]] as const) {
      const day = lunarDay(kind, y);
      if (!day) continue;
      const three = [addDays(day, -1), day, addDays(day, 1)];
      for (const d of three) out.set(d, name);
      // 대체공휴일: 사흘 중 일요일이 끼면 다음 평일 하루 (천문연구원 자료가 3개월 앞까지만이라 그 너머는 규칙으로)
      if (three.some((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0)) out.set(addDays(day, 2), name);
    }
  }
  return out;
}

const weekend = (d: string) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());

/** from 다음 날부터 days일 안의 연휴 묶음 (가까운 순) */
export function upcomingHolidayWindows(from: string, days = 120, known?: Map<string, string>): HolidayWindow[] {
  const names = holidayNames(from, days + 7, known);
  const out: HolidayWindow[] = [];
  let i = 1;
  while (i <= days) {
    const d = addDays(from, i);
    if (!names.has(d)) {
      i++;
      continue;
    }
    // 공휴일 앞뒤로 붙은 쉬는 날(주말·공휴일)까지 넓힌다
    let start = d;
    while (weekend(addDays(start, -1)) || names.has(addDays(start, -1))) start = addDays(start, -1);
    let end = d;
    while (weekend(addDays(end, 1)) || names.has(addDays(end, 1))) end = addDays(end, 1);
    const run: string[] = [];
    for (let x = addDays(start, -1); x <= end; x = addDays(x, 1)) run.push(x);
    const name = run.map((x) => names.get(x)).find((n) => n && n !== "공휴일") ?? "공휴일";
    if (addDays(start, -1) > from) out.push({ name, days: run });
    i += run.length;
  }
  return out;
}
