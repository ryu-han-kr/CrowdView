// 여행 날짜 저장 (Plus, 레퍼런스: TouringPlans 'Crowd change notifications for YOUR dates').
// 장소 상세에서 날짜를 저장해 두면, 매일 아침 그날 예측을 다시 계산해 단계가 바뀌면 알리고, 전날 아침에 한 번 더 알린다.
import { localePath } from "@/i18n/config";
import { formatHour } from "@/i18n/translate";
import { pushToUser } from "./alerts";
import { kv } from "./cache";
import { forecastForDate, weekForecast } from "./crowd/model";
import { getSignals } from "./crowd/signals";
import { sql } from "./db";
import { LEVELS, levelOf } from "./levels";
import { PLACES, placeHref } from "./places";
import { addDays, kst } from "./time";
import type { Place } from "./types";

// 저장된 날짜가 하나라도 있는지 Redis 표시 (없으면 아침 점검이 DB를 깨우지 않는다)
const ANY_KEY = "trips:any";
export const markTripsExist = () => kv.set(ANY_KEY, "1", 400 * 24 * 3600).catch(() => {});

export const tripPlace = (placeId: string): Place | undefined => PLACES.find((p) => p.id === placeId && p.category !== "airport");

/** 그날 예측: 가장 붐빌 때 단계(1~5)와 가장 한산한 운영 시간 */
export async function tripForecast(place: Place, date: string): Promise<{ level: number; calmHour?: number }> {
  const s = await getSignals(place).catch(() => ({}));
  const [day] = weekForecast(place, s, 1, date);
  const last = place.hours[1] >= 24 ? 23 : place.hours[1] - 2;
  const calm = forecastForDate(place, date, s)
    .filter((p) => p.hour >= place.hours[0] && p.hour <= last)
    .sort((a, b) => a.score - b.score)[0];
  return { level: levelOf(day.peakScore).key, calmHour: calm?.hour };
}

interface Row {
  user_id: string;
  place_id: string;
  date: string;
  last_level: number | null;
  eve_sent: boolean;
}

const label = (key: number) => LEVELS.find((l) => l.key === key)?.label ?? "";
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 매일 아침 1번: 저장된 날짜의 예측을 다시 보고 알린다. 보낸 수 */
export async function checkTripWatches(): Promise<number> {
  if (!(await kv.get(ANY_KEY).catch(() => "1"))) return 0;
  const today = kst().date;
  await sql("delete from trip_watch where date < $1", [today]);
  const rows = await sql<Row>(
    `select t.user_id, t.place_id, to_char(t.date, 'YYYY-MM-DD') as date, t.last_level, t.eve_sent
     from trip_watch t join plus_subscription s on s.user_id = t.user_id
     where s.status <> 'expired' and s.current_period_end > now()`,
  );
  if (!rows.length) {
    const left = await sql<{ n: number }>("select count(*)::int as n from trip_watch");
    if (!left[0]?.n) await kv.set(ANY_KEY, "", 1).catch(() => {});
    return 0;
  }
  let sent = 0;
  const tomorrow = addDays(today, 1);
  for (const r of rows) {
    const place = tripPlace(r.place_id);
    if (!place) continue;
    const f = await tripForecast(place, r.date);
    const name = place.name;
    const href = placeHref(place);
    if (r.date === tomorrow && !r.eve_sent) {
      sent += await pushToUser(r.user_id, (t, lang) => ({
        title: t("내일 {name} 예상 '{level}'", { name: t(name), level: t(label(f.level)) }),
        body:
          f.calmHour !== undefined
            ? t("가장 한산한 때는 {hour}쯤이에요 · 눌러서 시간대별 보기", { hour: formatHour(f.calmHour, lang) })
            : t("눌러서 시간대별 예측 보기"),
        url: localePath(lang, href),
        tag: `trip-${place.id}-${r.date}-eve`,
      }));
      await sql("update trip_watch set eve_sent = true, last_level = $4 where user_id = $1 and place_id = $2 and date = $3", [
        r.user_id,
        r.place_id,
        r.date,
        f.level,
      ]);
    } else if (r.last_level !== null && r.last_level !== f.level) {
      sent += await pushToUser(r.user_id, (t, lang) => ({
        title: t("{date} {name} 예측이 바뀌었어요", { date: md(r.date), name: t(name) }),
        body: t("'{from}' → '{to}' · 눌러서 자세히 보기", { from: t(label(r.last_level!)), to: t(label(f.level)) }),
        url: localePath(lang, href),
        tag: `trip-${place.id}-${r.date}`,
      }));
      await sql("update trip_watch set last_level = $4 where user_id = $1 and place_id = $2 and date = $3", [r.user_id, r.place_id, r.date, f.level]);
    } else if (r.last_level === null) {
      await sql("update trip_watch set last_level = $4 where user_id = $1 and place_id = $2 and date = $3", [r.user_id, r.place_id, r.date, f.level]);
    }
  }
  return sent;
}
