// 홈 통합 검색 탭 자료 (lib/home-search). 빌드 때는 만들지 않고(빌드 중 Redis·API 호출을 늘리지 않게) 처음 요청 때 만들어 5분 보관
import { LANGS, type Lang } from "@/i18n/config";
import { homeSearch } from "@/lib/home-search";

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang;
  if (!(LANGS as readonly string[]).includes(lang)) return new Response("not found", { status: 404 });
  return Response.json(await homeSearch(lang as Lang), { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=300" } });
}
