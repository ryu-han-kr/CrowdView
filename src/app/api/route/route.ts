// 추천 루트 만들기. POST {start:{lat,lng,name}, day, hour, durationMin, interests, transport, picks}
// day: 오늘부터 며칠 뒤(0~6), hour: 출발 시(없으면 지금). 예전 형식 offsetMin(지금부터 분)도 받는다
// 다시 짜기: startMin(오늘 0시부터 분) + exclude(이미 들른 곳)를 보내면 그 시각·위치부터 남은 시간으로 짠다.
// 결제가 켜져 있으면 Plus가 아닌 회원은 앞의 2곳만 보여준다 (미리보기). 결제 전에는 베타로 전부 공개.
// 결과는 공유 링크(/r/{id})용으로 30일 저장한다 (lib/route-share)
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import type { Transport } from "@/lib/geo";
import { isPlus } from "@/lib/plus";
import { tossEnabled } from "@/lib/toss";
import { INTERESTS, planRoute, type Candidate, type Interest } from "@/lib/route";
import { MEAL_SPOTS, getCustomCandidates, getExtraCandidates, getKakaoCandidates, getPickCandidates, getRouteCandidates, transitTravel } from "@/lib/route-data";
import { getGuidePlace, guideText } from "@/lib/seoul-guide";
import { addDays, kst } from "@/lib/time";
import { getSignals } from "@/lib/crowd/signals";
import { distanceKm } from "@/lib/geo";
import { PLACES } from "@/lib/places";
import { isLang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import { saveSharedRoute } from "@/lib/route-share";
import { rateLimit } from "@/lib/ratelimit";

const PREVIEW_STOPS = 2;

/**
 * 코스 시간대의 날씨 경고: 비 예보(강수 형태 또는 강수확률 60% 이상), 초미세먼지 '나쁨' 이상 예보.
 * 출발지에서 가장 가까운 우리 장소의 예보를 빌려 쓴다 (이미 캐시된 기상청·에어코리아 값이라 추가 호출 거의 없음)
 */
async function weatherWarnings(lat: number, lng: number, startMin: number, endMin: number, t: ReturnType<typeof getT>): Promise<string[]> {
  const near = PLACES.filter((p) => p.category !== "airport").sort((a, b) => distanceKm({ lat, lng }, a) - distanceKm({ lat, lng }, b))[0];
  if (!near || distanceKm({ lat, lng }, near) > 30) return [];
  const s = await getSignals(near);
  const today = kst().date;
  const out: string[] = [];
  for (let h = Math.floor(startMin / 60); h <= Math.floor(endMin / 60); h++) {
    const w = s.weather?.get(`${addDays(today, Math.floor(h / 24))} ${String(h % 24).padStart(2, "0")}`);
    if (w && ((w.pty ?? 0) > 0 || (w.pop ?? 0) >= 60)) {
      out.push(t("{h}시쯤 비 예보가 있어요 (강수확률 {pop}%). 실내 장소를 담거나 우산을 챙기세요.", { h: h % 24, pop: w.pop ?? 0 }));
      break;
    }
  }
  const pm = s.airForecast?.get(addDays(today, Math.floor(startMin / 1440)));
  if (pm && pm >= 3) out.push(t("이날 초미세먼지 ‘{grade}’ 예보예요. 야외 일정은 짧게 잡는 게 좋아요.", { grade: t(pm >= 4 ? "매우나쁨" : "나쁨") }));
  return out;
}
let memo: { at: number; data: Candidate[] } | undefined;

async function candidates() {
  // 혼잡 데이터는 10분 단위로 바뀌어 1분 동안은 같은 후보를 다시 쓴다
  if (!memo || Date.now() - memo.at > 60_000) memo = { at: Date.now(), data: await getRouteCandidates() };
  return memo.data;
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "route");
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as {
    start?: { lat?: number; lng?: number; name?: string };
    offsetMin?: number;
    day?: number;
    hour?: number | null;
    durationMin?: number;
    interests?: string[];
    transport?: string;
    lang?: string;
    /** ☆로 담은 곳 id (seoul-<코드> | vs-<코드>) */
    picks?: string[];
    /** 다시 짜기: 출발 시각(오늘 0시부터 분)과 빼고 짤 장소 */
    startMin?: number;
    exclude?: string[];
    /** 검색해서 직접 넣은 곳 (최대 6) */
    custom?: { name?: string; lat?: number; lng?: number; href?: string }[];
  };
  const lat = Number(body.start?.lat);
  const lng = Number(body.start?.lng);
  // 대한민국 범위 밖 좌표는 받지 않는다
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return NextResponse.json({ error: "출발지가 한국 밖이에요" }, { status: 400 });
  const interests = (body.interests ?? []).filter((i): i is Interest => INTERESTS.some((x) => x.id === i));
  // 담은 곳: 서울 실시간(seoul-), 여행 가이드(vs-), 우리 장소 id (공유 코스를 담을 때)
  const pickIds = (Array.isArray(body.picks) ? body.picks : [])
    .filter((x): x is string => typeof x === "string" && (/^(seoul-|vs-)[\w-]{1,40}$/.test(x) || PLACES.some((p) => p.id === x)))
    .slice(0, 6);
  const custom = (Array.isArray(body.custom) ? body.custom : [])
    .map((c) => ({ name: String(c?.name ?? "").slice(0, 60), lat: Number(c?.lat), lng: Number(c?.lng), href: typeof c?.href === "string" ? c.href.slice(0, 300) : undefined }))
    .filter((c) => c.name && c.lat > 33 && c.lat < 39 && c.lng > 124 && c.lng < 132)
    .slice(0, 6);
  if (!interests.length && !pickIds.length && !custom.length) return NextResponse.json({ error: "관심사를 하나 이상 골라 주세요" }, { status: 400 });
  const transport: Transport = body.transport === "walk" ? "walk" : body.transport === "car" ? "car" : "transit";
  // 출발: 오늘~6일 뒤. 서울시 12시간 예측 밖은 지하철 승하차 모양·장소 예측 모델로 (lib/forecast). 일정은 2~8시간
  const replan = Number.isFinite(Number(body.startMin)) && body.startMin !== undefined;
  // 다시 짤 때는 남은 시간이 짧을 수 있어 1시간부터
  const durationMin = Math.min(480, Math.max(replan ? 60 : 120, Math.round(Number(body.durationMin) || 240)));
  const now = kst();
  const nowMin = Math.ceil((Math.floor(now.hour * 60) + 5) / 10) * 10;
  const day = Math.min(6, Math.max(0, Math.round(Number(body.day) || 0)));
  const hourNum = Number(body.hour);
  const hour = body.hour === null || body.hour === undefined || !Number.isFinite(hourNum) ? null : Math.min(23, Math.max(0, Math.round(hourNum)));
  const startMin = replan
    ? Math.min(7 * 1440, Math.max(nowMin, Math.round(Number(body.startMin))))
    : body.day === undefined && body.offsetMin !== undefined
      ? Math.ceil((Math.floor(now.hour * 60) + Math.min(360, Math.max(0, Math.round(Number(body.offsetMin) || 0))) + 5) / 10) * 10
      : day === 0
        ? Math.max(nowMin, hour === null ? 0 : hour * 60)
        : day * 1440 + (hour ?? 9) * 60;

  // 기본 후보 + 세분 관심사(카페·맛집·전시는 우리 자료, 애니·백화점·플래그십은 카카오 장소 검색)
  const [base, extra, kakao, mine] = await Promise.all([
    candidates(),
    getExtraCandidates(interests),
    getKakaoCandidates(interests, { lat, lng }).catch(() => []),
    getCustomCandidates(custom),
  ]);
  const all = [...base, ...extra, ...kakao];
  const plan = planRoute(
    all,
    { start: { lat, lng, name: String(body.start?.name ?? "출발") }, startMin, durationMin, interests, transport },
    {
      travel: transitTravel,
      meals: MEAL_SPOTS,
      must: [...mine, ...(await getPickCandidates(pickIds, all))].slice(0, 6),
      exclude: (Array.isArray(body.exclude) ? body.exclude : []).filter((x): x is string => typeof x === "string").slice(0, 30),
    },
  );

  let locked = 0;
  if (tossEnabled) {
    const user = await currentUser(req.headers);
    if (!user || !(await isPlus(user.id))) {
      locked = Math.max(0, plan.stops.length - PREVIEW_STOPS);
      plan.stops = plan.stops.slice(0, PREVIEW_STOPS);
    }
  }
  // 장소 이름: 사전에 있으면 사전, 서울 지역 이름은 Papago (Redis 90일 캐시). 맛집은 가이드에 언어별 이름이 있다
  const lang = isLang(body.lang) ? body.lang : "ko";
  const t = getT(lang);
  const isGuide = (id: string) => id.startsWith("vs-");
  const names = await translateNames([...plan.stops.filter((s) => !isGuide(s.id)).map((s) => s.name), ...(plan.missedPicks ?? [])], lang);
  if (plan.missedPicks) plan.missedPicks = plan.missedPicks.map((n) => names.get(n) ?? t(n));
  plan.stops = plan.stops.map((s) => {
    const guide = isGuide(s.id) ? getGuidePlace(s.id) : undefined;
    return { ...s, name: guide ? guideText(guide, lang).text.n : (names.get(s.name) ?? t(s.name)) };
  });
  const start = { lat, lng, name: String(body.start?.name ?? "출발").slice(0, 60) };
  const warnings = plan.stops.length ? await weatherWarnings(lat, lng, startMin, plan.endMin, t).catch(() => []) : [];
  const shareId = plan.stops.length ? await saveSharedRoute({ plan, start, startMin, lang, locked }).catch(() => undefined) : undefined;
  return NextResponse.json({ plan, startMin, locked, beta: !tossEnabled, shareId, warnings });
}
