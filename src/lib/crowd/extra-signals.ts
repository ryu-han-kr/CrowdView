// 예측 보정 신호 2가지 (QA 10/21 정확도 개선 3·4번). 키가 없으면 아무것도 하지 않는다.
// 1) 네이버 데이터랩 검색어 트렌드 (NAVER_DATALAB_CLIENT_ID/SECRET): 최근 7일 검색이 그 전 4주보다 늘면 앞으로 7일 조금 더 붐빈다고 본다
// 2) 나이스 학사일정 (NEIS_API_KEY): 서울·경기 초등학교 표본 중 쉬는 학교(방학·재량휴업) 비율 → 평일 놀이공원·워터파크·스키장 보정
import { cached } from "../cached";
import { addDays, kst } from "../time";

const HOUR = 3600;

// ── 1) 검색어 트렌드
/** 순수 계산: 날짜별 검색 지수 → (최근 7일 평균 / 그 전 28일 평균), 0.85 ~ 1.2로 자른다. 자료가 모자라면 undefined */
export function trendFrom(values: number[]): number | undefined {
  if (values.length < 21) return undefined;
  const recent = values.slice(-7);
  const before = values.slice(-35, -7);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  if (avg(before) <= 0) return undefined;
  // 검색이 2배 늘어도 사람은 그만큼 늘지 않는다 → 변화의 절반만 반영
  const r = 1 + (avg(recent) / avg(before) - 1) * 0.5;
  return Math.max(0.85, Math.min(1.2, Math.round(r * 100) / 100));
}

export async function getSearchTrend(keyword: string): Promise<number | undefined> {
  // 환경변수에 앞뒤 공백·줄바꿈이 섞여 들어가면 인증이 실패한다
  const id = process.env.NAVER_DATALAB_CLIENT_ID?.trim();
  const secret = process.env.NAVER_DATALAB_CLIENT_SECRET?.trim();
  if (!id || !secret) return undefined;
  const today = kst().date;
  return cached(`trend:${keyword}`, 12 * HOUR, async () => {
    const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: addDays(today, -35),
        endDate: addDays(today, -1),
        timeUnit: "date",
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`datalab ${res.status}`);
    const j = (await res.json()) as { results?: { data?: { period: string; ratio: number }[] }[] };
    return trendFrom((j.results?.[0]?.data ?? []).map((d) => d.ratio));
  }).catch(() => undefined);
}

// ── 2) 학사일정
interface NeisRow {
  AA_YMD?: string;
  EVENT_NM?: string;
  SBTR_DD_SC_NM?: string;
}

/** 쉬는 날인지: 수업일수에서 빠지는 '휴업일'이거나 방학 */
export const isSchoolOff = (r: NeisRow) => r.SBTR_DD_SC_NM === "휴업일" || /방학/.test(r.EVENT_NM ?? "");

/** 순수 계산: 학교별 일정 → 날짜별 쉬는 학교 비율 (0~1) */
export function offShare(schools: NeisRow[][]): Map<string, number> {
  const count = new Map<string, number>();
  for (const rows of schools) {
    const days = new Set(rows.filter(isSchoolOff).map((r) => String(r.AA_YMD)));
    for (const d of days) count.set(d, (count.get(d) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [ymd, n] of count) out.set(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`, Math.round((n / schools.length) * 100) / 100);
  return out;
}

const NEIS = "https://open.neis.go.kr/hub";
/** 서울(B10)·경기(J10) 초등학교 표본 */
const REGIONS = ["B10", "J10"];
const PER_REGION = 10;

async function neis<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams({ KEY: process.env.NEIS_API_KEY!, Type: "json", pIndex: "1", ...params });
  const res = await fetch(`${NEIS}/${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
  const j = (await res.json()) as Record<string, [{ head: unknown }, { row: T[] }] | undefined>;
  return j[path]?.[1]?.row ?? [];
}

/** 앞으로 60일 날짜별 쉬는 학교 비율 (하루 한 번 갱신) */
export async function getSchoolOff(): Promise<Map<string, number> | undefined> {
  if (!process.env.NEIS_API_KEY) return undefined;
  const today = kst().date;
  const entries = await cached(`neis:off:${today}`, 24 * HOUR, async () => {
    const schools = (
      await Promise.all(
        REGIONS.map((r) =>
          neis<{ SD_SCHUL_CODE: string }>("schoolInfo", { pSize: String(PER_REGION), ATPT_OFCDC_SC_CODE: r, SCHUL_KND_SC_NM: "초등학교" }).then(
            (rows) => rows.map((s) => [r, s.SD_SCHUL_CODE] as const),
          ),
        ),
      )
    ).flat();
    const from = today.replaceAll("-", "");
    const to = addDays(today, 60).replaceAll("-", "");
    const schedules = await Promise.all(
      schools.map(([r, code]) =>
        neis<NeisRow>("SchoolSchedule", { pSize: "365", ATPT_OFCDC_SC_CODE: r, SD_SCHUL_CODE: code, AA_FROM_YMD: from, AA_TO_YMD: to }),
      ),
    );
    return schools.length ? [...offShare(schedules)] : [];
  }).catch(() => [] as [string, number][]);
  return entries.length ? new Map(entries) : undefined;
}
