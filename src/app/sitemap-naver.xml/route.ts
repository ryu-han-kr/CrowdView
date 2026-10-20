// 네이버 서치어드바이저용 단순 사이트맵: 한국어 주소만, <loc>·<lastmod>(날짜)만.
// 기본 /sitemap.xml은 언어별 주소(xhtml:link)가 함께 들어 있어 2MB가 넘고, 네이버 검사기가 "형식이 올바르지 않다"고 거절했다
import sitemap from "../sitemap";

export const revalidate = 21600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const entries = await sitemap();
  const day = (d: unknown) => (d instanceof Date ? d : new Date(String(d ?? Date.now()))).toISOString().slice(0, 10);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => `<url><loc>${esc(e.url)}</loc><lastmod>${day(e.lastModified)}</lastmod></url>`),
    "</urlset>",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=21600, stale-while-revalidate=3600" },
  });
}
