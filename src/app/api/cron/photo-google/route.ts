// 사진 고르기 후보: 구글 지도에 올라온 방문자 사진 (경수님 10/30: 관광공사·위키미디어에 밝은 사진이 없는 곳 — 광주패밀리랜드).
// 키(GOOGLE_PLACES_API_KEY)가 Vercel 비밀 값이라 운영 서버에서 돌린다 — CRON_SECRET이 있어야 부를 수 있다. scripts/korea-data/photo-pick.mts (GOOGLE=1)가 부른다.
// 구글 약관: 사진 파일은 저장하지 않고(사진 이름만 기록 → api/gphoto 가 그때그때 받아 보냄), 작성자 이름을 사진에 표시한다
import { NextResponse } from "next/server";
import { APIS, countCall, getMonthUsage, QuotaError } from "@/lib/api-quota";
import { getPlace } from "@/lib/places";

export const maxDuration = 60;

const API = APIS.find((a) => a.id === "google-places");
const MAX = 10;
// 사진 고르기는 가끔 손으로 돌리는 일이라 하루 한도 대신 이달 누적으로 막는다: 구글 사진 무료 월 1,000장보다 여유 있게 (경수님 10/30 '무료분 안에서')
const MONTH_CAP = 900;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { id?: string; max?: number } | null;
  const p = body?.id ? getPlace(body.id) : undefined;
  if (!p) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const max = Math.min(MAX, Math.max(1, Number(body?.max) || MAX));
  try {
    const used = await getMonthUsage("google-places");
    if (used + 1 + max > MONTH_CAP) return NextResponse.json({ error: `이달 구글 사진 ${used}회 — 무료분 보호선(${MONTH_CAP}) 도달` }, { status: 429 });
    await countCall(API, 1 + max);
    const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.photos" },
      body: JSON.stringify({ textQuery: p.name, languageCode: "ko", regionCode: "KR", locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 1500 } } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!search.ok) return NextResponse.json({ error: `search ${search.status}` }, { status: 502 });
    type Photo = { name: string; widthPx: number; heightPx: number; authorAttributions?: { displayName?: string; uri?: string }[] };
    const photos = ((await search.json()) as { places?: { photos?: Photo[] }[] }).places?.[0]?.photos ?? [];
    const out = await Promise.all(
      photos.slice(0, max).map(async (ph) => {
        const media = await fetch(`https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=1600&skipHttpRedirect=true&key=${key}`, { signal: AbortSignal.timeout(10_000) });
        const uri = media.ok ? ((await media.json()) as { photoUri?: string }).photoUri : undefined;
        const a = ph.authorAttributions?.[0];
        return uri ? { name: ph.name, uri, w: ph.widthPx, h: ph.heightPx, author: a?.displayName ?? "", authorUri: a?.uri } : null;
      }),
    );
    return NextResponse.json({ photos: out.filter(Boolean) });
  } catch (e) {
    if (e instanceof QuotaError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
}
