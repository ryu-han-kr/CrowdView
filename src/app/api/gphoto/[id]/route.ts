import { APIS, beforeCall } from "@/lib/api-quota";
import { cached } from "@/lib/cached";
import { PLACES } from "@/lib/places";
import { GOOGLE_PHOTO } from "@/lib/places-google";

// 사진 없는 장소(오락실·클라이밍장)의 대표 사진을 구글 플레이스(New)에서 받아 보낸다 (경수님 10/27 키).
// 구글 약관상 사진 파일은 우리 저장소에 두지 않는다 — 사진 주소(photoUri)만 캐시하고, 응답은 CDN이 보관.
// 비용: 장소마다 Text Search + Place Photo 1회씩이 30일에 1번 꼴 → 181곳(오락실 등 22 + 클라이밍 159)이면 월 약 180장 (사진 월 1,000장 무료).
// 10/27 처음엔 하루 캐시였는데 클라이밍장을 더하면 월 5,000장이 넘어 30일로 늘렸다
const API = APIS.find((a) => a.id === "google-places");
// 사진을 못 받을 때(키 없음·한도·장애) 보내는 어두운 회색 그림. 404로 숨기면 카드 위 흰 글자가 밝은 바탕에 남아 읽기 어렵다(접근성 검사 10/27)
const FALLBACK = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAwAAAAQCAIAAACtAwlQAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGElEQVQokWNwD80kiBhGFTGMBgEDMUEAAEwOw8EDTVFpAAAAAElFTkSuQmCC", "base64");
const fallback = (maxAge: number) =>
  new Response(FALLBACK, { headers: { "Content-Type": "image/png", "Cache-Control": `public, s-maxage=${maxAge}` } });

/** 구글에서 사진 주소를 새로 받는다 (검색 1 + 사진 1) */
async function lookup(id: string): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const p = PLACES.find((x) => x.id === id);
  if (!key || !p) return null;
  await beforeCall(API, 2);
  const search = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.photos.name" },
    body: JSON.stringify({
      textQuery: p.name,
      languageCode: "ko",
      regionCode: "KR",
      locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 800 } },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!search.ok) throw new Error(`google places search ${search.status}`);
  const photo = ((await search.json()) as { places?: { photos?: { name: string }[] }[] }).places?.[0]?.photos?.[0]?.name;
  if (!photo) return null;
  const media = await fetch(`https://places.googleapis.com/v1/${photo}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${key}`, { signal: AbortSignal.timeout(8000) });
  if (!media.ok) throw new Error(`google places photo ${media.status}`);
  return ((await media.json()) as { photoUri?: string }).photoUri ?? null;
}

const photoUri = (id: string) => cached(`gphoto:${id}`, 30 * 86400, () => lookup(id));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!GOOGLE_PHOTO.has(id)) return new Response("not found", { status: 404 });
  try {
    const uri = await photoUri(id);
    if (!uri) return fallback(3600);
    let img = await fetch(uri, { signal: AbortSignal.timeout(8000) });
    // 캐시해 둔 사진 주소가 만료됐으면 한 번 새로 받는다
    if (!img.ok) {
      const fresh = await lookup(id);
      if (fresh) img = await fetch(fresh, { signal: AbortSignal.timeout(8000) });
    }
    if (!img.ok || !img.body) throw new Error(`photo ${img.status}`);
    return new Response(img.body, {
      headers: {
        "Content-Type": img.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.warn("[gphoto]", id, e instanceof Error ? e.message : e);
    return fallback(300);
  }
}
