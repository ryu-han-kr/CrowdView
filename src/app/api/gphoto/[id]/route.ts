import { APIS, beforeCall } from "@/lib/api-quota";
import { cached } from "@/lib/cached";
import { PLACES } from "@/lib/places";
import { GOOGLE_PHOTO } from "@/lib/places-google";

// 사진 없는 장소(오락실·클라이밍장)의 대표 사진을 구글 플레이스(New)에서 받아 보낸다 (경수님 10/27 키).
// 구글 약관상 사진은 저장하지 않고 그때그때 받는다 — 사진 주소(photoUri)만 하루 캐시, 응답은 CDN이 하루 보관.
// 비용: Text Search(사진 이름) + Place Photo 각 1회가 하루 장소당 많아야 1번 → 22곳이면 월 약 660장 (사진 월 1,000장 무료)
const API = APIS.find((a) => a.id === "google-places");

async function photoUri(id: string): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const p = PLACES.find((x) => x.id === id);
  if (!key || !p) return null;
  return cached(`gphoto:${id}`, 24 * 3600, async () => {
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
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!GOOGLE_PHOTO.has(id)) return new Response("not found", { status: 404 });
  try {
    const uri = await photoUri(id);
    if (!uri) return new Response("no photo", { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
    const img = await fetch(uri, { signal: AbortSignal.timeout(8000) });
    if (!img.ok || !img.body) throw new Error(`photo ${img.status}`);
    return new Response(img.body, {
      headers: {
        "Content-Type": img.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.warn("[gphoto]", id, e instanceof Error ? e.message : e);
    return new Response("error", { status: 502, headers: { "Cache-Control": "public, s-maxage=300" } });
  }
}
