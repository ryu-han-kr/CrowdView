// 서울 121곳의 지하철·버스 승하차와 공영주차장 점유를 매시 한 번 Redis에 남긴다 (학습 모델 입력용 실측, 10/31).
// 서울시 전체판(citydata)은 지역 상세를 열 때만 부르던 것 → 매시 정각 첫 수집 때 121곳을 한 번씩 직접 받아 한 키에 쓴다
// (지역별 캐시를 거치지 않아 Redis 명령은 한 시간에 3번: 중복 막기·호출 집계·저장).
// 점수에는 아직 쓰지 않는다: 서울시 혼잡 단계가 이미 대중교통 승하차로 보정돼 있고(매뉴얼 표 3-7), 지역 안 시설의
// '평소 대비'도 같은 지역 인구에서 나와 겹친다. 실시간 주차가 나오는 공영주차장은 121곳 중 일부뿐이다 → 몇 주 쌓아 모델 입력으로 시험
import { APIS, beforeCall } from "./api-quota";
import { kv } from "./cache";
import { SEOUL_AREAS } from "./seoul-areas";
import { fetchSeoulAreaExtra, type SeoulAreaExtra } from "./seoul-live";
import { kst } from "./time";

/** KST 시 (YYYY-MM-DDTHH) */
const hourKey = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 13);
/** 지역 코드 → ExtraRow. 기록한 시각(정각~5분)의 KST 시가 키 */
export const extraLogKey = (hour: string) => `acc:x:${hour}`;
const KEEP = 60 * 86_400;

/**
 * [지하철 30분 승차, 하차, 버스 30분 승차, 하차, 주차 %, 지하철 오늘 누적 승차, 하차, 버스 오늘 누적 승차, 하차]. 없으면 null.
 * 누적은 04시부터라 이웃한 두 시각의 차가 그 한 시간 승하차다
 */
export type ExtraRow = (number | null)[];

export function extraRow(e: SeoulAreaExtra): ExtraRow | undefined {
  const { subway: s, bus: b, parking: p } = e;
  if (!s && !b && !p) return undefined;
  const v = (n: number | undefined) => n ?? null;
  return [v(s?.in30), v(s?.out30), v(b?.in30), v(b?.out30), v(p?.pct), v(s?.inDay), v(s?.outDay), v(b?.inDay), v(b?.outDay)];
}

/** 매시 정각 첫 수집 때 (cron/refresh). 이번 시각은 한 번만. 기록한 지역 수 */
export async function recordSeoulExtras(now = new Date()): Promise<number> {
  const key = process.env.SEOUL_OPENAPI_KEY;
  if (!key) return 0;
  // 01~05시는 서울시가 승하차를 내지 않고 주차도 거의 그대로라 건너뛴다 (호출 121번 아끼기)
  const h = Math.floor(kst(now).hour);
  if (h >= 1 && h < 5) return 0;
  const hour = hourKey(now);
  if (!(await kv.setNX(`acc:x:done:${hour}`, "1", 2 * 86_400).catch(() => false))) return 0;
  await beforeCall(
    APIS.find((a) => a.id === "seoul-citydata"),
    SEOUL_AREAS.length,
  );
  const out: Record<string, ExtraRow> = {};
  const queue = [...SEOUL_AREAS];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        const e = await fetchSeoulAreaExtra(key, a.name).catch(() => undefined);
        const row = e && extraRow(e);
        if (row) out[a.code] = row;
      }
    }),
  );
  const n = Object.keys(out).length;
  if (n) await kv.set(extraLogKey(hour), JSON.stringify(out), KEEP).catch(() => {});
  return n;
}
