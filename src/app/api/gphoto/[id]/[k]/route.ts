// 사진 고르기에서 Claude가 고른 구글 지도 방문자 사진을 보낸다 (경수님 10/30: 관광공사·위키미디어에 밝은 사진이 없는 곳).
// 구글 약관상 사진 파일은 저장하지 않는다 — photo-picks.json에는 사진 이름(gname)과 짧은 키만, 사진 주소는 30일 캐시하고 응답은 CDN이 보관.
// 주소에 쿼리를 쓰지 않는 건 Next 16 next/image가 쿼리 붙은 로컬 사진을 막아서 (images.localPatterns)
import { APIS, beforeCall } from "@/lib/api-quota";
import { cached } from "@/lib/cached";
import picks from "@/data/korea/photo-picks.json";

const API = APIS.find((a) => a.id === "google-places");
const PICKED = picks as Record<string, { photos: { src: string; gname?: string }[] }>;

async function media(name: string): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  await beforeCall(API, 1);
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1600&skipHttpRedirect=true&key=${key}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`google places photo ${res.status}`);
  return ((await res.json()) as { photoUri?: string }).photoUri ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; k: string }> }) {
  const { id, k } = await params;
  const name = PICKED[id]?.photos.find((p) => p.src === `/api/gphoto/${id}/${k}`)?.gname;
  if (!name) return new Response("not found", { status: 404 });
  try {
    const load = () => media(name);
    const uri = await cached(`gphoto:n:${name}`, 30 * 86400, load);
    if (!uri) return new Response("not found", { status: 404 });
    let img = await fetch(uri, { signal: AbortSignal.timeout(8000) });
    // 캐시해 둔 사진 주소가 만료됐으면 한 번 새로 받는다
    if (!img.ok) {
      const fresh = await load();
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
    console.warn("[gphoto]", id, k, e instanceof Error ? e.message : e);
    return new Response("unavailable", { status: 503 });
  }
}
