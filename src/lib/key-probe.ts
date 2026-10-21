// 새로 넣은 API 키가 실제로 되는지 서버에서 한 번 불러 본다 (Vercel의 Sensitive 값은 밖에서 읽을 수 없어 운영 서버에서만 확인 가능).
// /api/health 의 keyProbe 로 보인다: 키 값은 절대 내보내지 않고 정상 여부와 원본 응답 앞부분(키는 가림)만. 30분 저장
import { kv } from "./cache";

export interface ProbeResult {
  configured: boolean;
  ok?: boolean;
  status?: number;
  /** 원본 응답 앞부분 (키는 *** 로 가림) */
  sample?: string;
  /** JSON이면 첫 항목의 필드 이름 (화면에 쓸 값이 있는지 확인용) */
  fields?: string[];
  /** 응답까지 걸린 시간 (ms) — 국가교통정보센터 시간 초과 원인 확인용 */
  ms?: number;
  /** JSON 맨 위의 숫자·글자 값 (전체 건수 등 — 나눠 받기 크기 확인용) */
  meta?: Record<string, unknown>;
}

/** 응답 JSON에서 첫 번째 '항목' 객체를 찾아 필드 이름만 */
function firstItemFields(body: string): string[] | undefined {
  try {
    const walk = (v: unknown, depth = 0): string[] | undefined => {
      if (depth > 5 || !v || typeof v !== "object") return undefined;
      if (Array.isArray(v)) return v[0] && typeof v[0] === "object" ? Object.keys(v[0]) : undefined;
      for (const x of Object.values(v)) {
        const r = walk(x, depth + 1);
        if (r) return r;
      }
      return undefined;
    };
    return walk(JSON.parse(body));
  } catch {
    return undefined;
  }
}

interface Probe {
  id: string;
  env: string;
  url: (key: string) => string;
  /** POST 등 (네이버 데이터랩) */
  init?: (key: string) => RequestInit;
  ok: (status: number, body: string) => boolean;
}

const PROBES: Probe[] = [
  {
    // 국가교통정보센터 실시간 소통 (서울시청 부근 작은 범위)
    id: "its",
    env: "ITS_API_KEY",
    url: (k) =>
      `https://openapi.its.go.kr:9443/trafficInfo?apiKey=${k}&type=all&drcType=all&minX=126.97&maxX=126.99&minY=37.56&maxY=37.57&getType=json`,
    ok: (s, b) => s === 200 && /"items"|"body"/.test(b) && !/error|인증|invalid/i.test(b.slice(0, 200)),
  },
  {
    // 한국도로공사 실시간 교통량
    id: "ex",
    env: "EX_API_KEY",
    url: (k) => `https://data.ex.co.kr/openapi/odtraffic/trafficAmountByRealtime?key=${k}&type=json&numOfRows=1&pageNo=1`,
    ok: (s, b) => s === 200 && /"code"\s*:\s*"SUCCESS"/.test(b),
  },
  {
    // 서울 실시간 지하철 도착 (서울역)
    id: "seoulSubway",
    env: "SEOUL_SUBWAY_KEY",
    url: (k) => `http://swopenapi.seoul.go.kr/api/subway/${k}/json/realtimeStationArrival/0/1/${encodeURIComponent("서울")}`,
    ok: (s, b) => s === 200 && /realtimeArrivalList/.test(b),
  },
  {
    // 한국도로공사 영업소(나들목) 위치 — 고속도로 구간 속도를 장소 근처에 붙이려면 좌표가 필요
    id: "exUnits",
    env: "EX_API_KEY",
    url: (k) => `https://data.ex.co.kr/openapi/locationinfo/locationinfoUnit?key=${k}&type=json&numOfRows=1&pageNo=1`,
    ok: (s, b) => s === 200 && /"code"s*:s*"SUCCESS"/.test(b),
  },
  {
    // 네이버 데이터랩 검색어 트렌드 (아이디는 주소에, 비밀번호는 머리글에)
    id: "naverDatalab",
    env: "NAVER_DATALAB_CLIENT_ID",
    url: () => "https://openapi.naver.com/v1/datalab/search",
    init: (id) => ({
      method: "POST",
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": process.env.NAVER_DATALAB_CLIENT_SECRET ?? "", "content-type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-09-01",
        endDate: "2026-09-07",
        timeUnit: "date",
        keywordGroups: [{ groupName: "롯데월드", keywords: ["롯데월드"] }],
      }),
    }),
    ok: (s, b) => s === 200 && /"results"/.test(b),
  },
  {
    // 나이스 학교 기본정보 (학사일정과 같은 키)
    id: "neis",
    env: "NEIS_API_KEY",
    url: (k) => `https://open.neis.go.kr/hub/schoolInfo?KEY=${k}&Type=json&pIndex=1&pSize=1&ATPT_OFCDC_SC_CODE=B10`,
    ok: (s, b) => s === 200 && /INFO-000/.test(b),
  },
];

/** JSON 맨 위(한 단계 아래까지)의 숫자·짧은 글자 값 */
function topMeta(body: string): Record<string, unknown> | undefined {
  try {
    const out: Record<string, unknown> = {};
    const j = JSON.parse(body) as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) {
      if (typeof v === "number" || (typeof v === "string" && v.length < 40)) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

async function probe(p: Probe): Promise<ProbeResult> {
  const key = process.env[p.env];
  if (!key) return { configured: false };
  const t0 = Date.now();
  try {
    // 느린 원본을 가려내려고 넉넉히 30초 (화면에서 쓰는 호출은 lib/roads의 15초)
    const res = await fetch(p.url(key), { ...p.init?.(key), signal: AbortSignal.timeout(30_000) });
    const body = await res.text();
    const sample = body.replaceAll(key, "***").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    return { configured: true, ok: p.ok(res.status, body), status: res.status, sample, fields: firstItemFields(body), meta: topMeta(body), ms: Date.now() - t0 };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      sample: String((e as { cause?: { code?: string } }).cause?.code ?? (e as Error).message).slice(0, 120),
      ms: Date.now() - t0,
    };
  }
}

/** 배포마다 새로 확인 (키를 바꾸고 다시 배포하면 바로 보이게) */
const PROBE_KEY = `probe:keys:v4:${process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local"}`;

/** 키별 확인 결과 (30분 동안 저장해 두고 다시 부르지 않는다) */
export async function probeKeys(): Promise<Record<string, ProbeResult>> {
  const saved = await kv.get(PROBE_KEY).catch(() => null);
  if (saved) return JSON.parse(saved);
  const results = Object.fromEntries(await Promise.all(PROBES.map(async (p) => [p.id, await probe(p)] as const)));
  await kv.set(PROBE_KEY, JSON.stringify(results), 30 * 60).catch(() => {});
  return results;
}
