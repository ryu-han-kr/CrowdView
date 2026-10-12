// API 응답을 CDN(Vercel Edge)에 캐시하는 헤더. 브라우저는 매번 CDN에 묻고(max-age=0),
// CDN은 60초 동안 같은 응답을 돌려주며, 만료 후 5분까지는 옛 응답을 주면서 뒤에서 갱신한다.
// 표준 HTTP 헤더라 CloudFront 등 다른 CDN에서도 그대로 동작한다.
export const CDN_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
};
