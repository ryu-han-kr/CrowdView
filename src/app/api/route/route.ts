// 추천 루트 만들기. POST {start:{lat,lng,name}, offsetMin, durationMin, interests, transport}
// 결제가 켜져 있으면 Plus가 아닌 회원은 앞의 2곳만 보여준다 (미리보기). 결제 전에는 베타로 전부 공개
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import type { Transport } from "@/lib/geo";
import { isPlus } from "@/lib/plus";
import { portoneEnabled } from "@/lib/portone";
import { INTERESTS, planRoute, type Candidate, type Interest } from "@/lib/route";
import { getRouteCandidates } from "@/lib/route-data";
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
    durationMin?: number;
    interests?: string[];
    transport?: string;
    lang?: string;
  };
  const lat = Number(body.start?.lat);
  const lng = Number(body.start?.lng);
  // 대한민국 범위 밖 좌표는 받지 않는다
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return NextResponse.json({ error: "출발지가 한국 밖이에요" }, { status: 400 });
  const interests = (body.interests ?? []).filter((i): i is Interest => INTERESTS.some((x) => x.id === i));
  if (!interests.length) return NextResponse.json({ error: "관심사를 하나 이상 골라 주세요" }, { status: 400 });
  const transport: Transport = body.transport === "walk" ? "walk" : "transit";
  // 서울시 예측이 12시간까지라 출발은 6시간 안, 일정은 2~8시간
  const offset = Math.min(360, Math.max(0, Math.round(Number(body.offsetMin) || 0)));
  const durationMin = Math.min(480, Math.max(120, Math.round(Number(body.durationMin) || 240)));
  const now = kst();
  const startMin = Math.ceil((Math.floor(now.hour * 60) + offset + 5) / 10) * 10;

  const plan = planRoute(await candidates(), {
    start: { lat, lng, name: String(body.start?.name ?? "출발") },
    startMin,
    durationMin,
    interests,
    transport,
  });

  let locked = 0;
  if (portoneEnabled) {
    const user = await currentUser(req.headers);
    if (!user || !(await isPlus(user.id))) {
      locked = Math.max(0, plan.stops.length - PREVIEW_STOPS);
      plan.stops = plan.stops.slice(0, PREVIEW_STOPS);
    }
  }
  // 장소 이름: 사전에 있으면 사전, 서울 지역 이름은 Papago (Redis 90일 캐시)
  const lang = isLang(body.lang) ? body.lang : "ko";
  const t = getT(lang);
  const names = await translateNames(plan.stops.map((s) => s.name), lang);
  plan.stops = plan.stops.map((s) => ({ ...s, name: names.get(s.name) ?? t(s.name) }));
  return NextResponse.json({ plan, startMin, locked, beta: !portoneEnabled });
}
