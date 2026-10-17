// 추천 루트 만들기. POST {start:{lat,lng,name}, day, hour, durationMin, interests, transport, picks}
// day: 오늘부터 며칠 뒤(0~6), hour: 출발 시(없으면 지금). 예전 형식 offsetMin(지금부터 분)도 받는다
// 결제가 켜져 있으면 Plus가 아닌 회원은 앞의 2곳만 보여준다 (미리보기). 결제 전에는 베타로 전부 공개
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import type { Transport } from "@/lib/geo";
import { isPlus } from "@/lib/plus";
import { portoneEnabled } from "@/lib/portone";
import { INTERESTS, planRoute, type Candidate, type Interest } from "@/lib/route";
import { MEAL_SPOTS, getPickCandidates, getRouteCandidates, transitTravel } from "@/lib/route-data";
import { getGuidePlace, guideText } from "@/lib/seoul-guide";
import { kst } from "@/lib/time";
import { isLang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";

const PREVIEW_STOPS = 2;
let memo: { at: number; data: Candidate[] } | undefined;

async function candidates() {
  // 혼잡 데이터는 10분 단위로 바뀌어 1분 동안은 같은 후보를 다시 쓴다
  if (!memo || Date.now() - memo.at > 60_000) memo = { at: Date.now(), data: await getRouteCandidates() };
  return memo.data;
}

export async function POST(req: Request) {
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
  };
  const lat = Number(body.start?.lat);
  const lng = Number(body.start?.lng);
  // 대한민국 범위 밖 좌표는 받지 않는다
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return NextResponse.json({ error: "출발지가 한국 밖이에요" }, { status: 400 });
  const interests = (body.interests ?? []).filter((i): i is Interest => INTERESTS.some((x) => x.id === i));
  const pickIds = (Array.isArray(body.picks) ? body.picks : []).filter((x): x is string => typeof x === "string" && /^(seoul-|vs-)[\w-]{1,40}$/.test(x)).slice(0, 6);
  if (!interests.length && !pickIds.length) return NextResponse.json({ error: "관심사를 하나 이상 골라 주세요" }, { status: 400 });
  const transport: Transport = body.transport === "walk" ? "walk" : "transit";
  // 출발: 오늘~6일 뒤. 서울시 12시간 예측 밖은 지하철 승하차 모양·장소 예측 모델로 (lib/forecast). 일정은 2~8시간
  const durationMin = Math.min(480, Math.max(120, Math.round(Number(body.durationMin) || 240)));
  const now = kst();
  const nowMin = Math.ceil((Math.floor(now.hour * 60) + 5) / 10) * 10;
  const day = Math.min(6, Math.max(0, Math.round(Number(body.day) || 0)));
  const hourNum = Number(body.hour);
  const hour = body.hour === null || body.hour === undefined || !Number.isFinite(hourNum) ? null : Math.min(23, Math.max(0, Math.round(hourNum)));
  const startMin =
    body.day === undefined && body.offsetMin !== undefined
      ? Math.ceil((Math.floor(now.hour * 60) + Math.min(360, Math.max(0, Math.round(Number(body.offsetMin) || 0))) + 5) / 10) * 10
      : day === 0
        ? Math.max(nowMin, hour === null ? 0 : hour * 60)
        : day * 1440 + (hour ?? 9) * 60;

  const all = await candidates();
  const plan = planRoute(
    all,
    { start: { lat, lng, name: String(body.start?.name ?? "출발") }, startMin, durationMin, interests, transport },
    { travel: transitTravel, meals: MEAL_SPOTS, must: await getPickCandidates(pickIds, all) },
  );

  let locked = 0;
  if (portoneEnabled) {
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
  return NextResponse.json({ plan, startMin, locked, beta: !portoneEnabled });
}
