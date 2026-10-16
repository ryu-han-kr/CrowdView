// 애드센스 판매자 확인 파일 (https://crowdview.app/ads.txt). 발행자 ID가 없으면 빈 파일
export function GET() {
  const pub = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.replace(/^ca-/, "");
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
