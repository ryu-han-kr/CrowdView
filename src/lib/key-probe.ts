// 새로 넣은 API 키가 실제로 되는지 서버에서 한 번 불러 본다 (Vercel의 Sensitive 값은 밖에서 읽을 수 없어 운영 서버에서만 확인 가능).
// /api/health 의 keyProbe 로 보인다: 키 값은 절대 내보내지 않고 정상 여부와 원본 응답 앞부분(키는 가림)만. 30분 저장
import { kv } from "./cache";

export interface ProbeResult {
  configured: boolean;
  ok?: boolean;
  status?: number;
  /** 원본 응답 앞부분 (키는 *** 로 가림) */
  sample?: string;
}

const PROBES: { id: string; env: string; url: (key: string) => string; ok: (status: number, body: string) => boolean }[] = [
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
];

async function probe(p: (typeof PROBES)[number]): Promise<ProbeResult> {
  const key = process.env[p.env];
  if (!key) return { configured: false };
  try {
    const res = await fetch(p.url(key), { signal: AbortSignal.timeout(10_000) });
    const body = await res.text();
    const sample = body.replaceAll(key, "***").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    return { configured: true, ok: p.ok(res.status, body), status: res.status, sample };
  } catch (e) {
    return { configured: true, ok: false, sample: String((e as { cause?: { code?: string } }).cause?.code ?? (e as Error).message).slice(0, 120) };
  }
}

/** 키별 확인 결과 (30분 동안 저장해 두고 다시 부르지 않는다) */
export async function probeKeys(): Promise<Record<string, ProbeResult>> {
  const saved = await kv.get("probe:keys").catch(() => null);
  if (saved) return JSON.parse(saved);
  const results = Object.fromEntries(await Promise.all(PROBES.map(async (p) => [p.id, await probe(p)] as const)));
  await kv.set("probe:keys", JSON.stringify(results), 30 * 60).catch(() => {});
  return results;
}
