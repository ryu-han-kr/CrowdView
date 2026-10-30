// next/image로 줄여 보낼 수 있는 사진인지 (next.config.ts images.remotePatterns와 같은 목록). 아니면 원본 그대로.
// 서울시 문화 사이트(culture.seoul.go.kr) 사진은 최적화 서버가 받지 못해(차단) 원본으로 둔다.
// 10/23 다시 확인: 허용 목록을 고쳐도 운영 최적화 서버가 502(서울시 서버가 Vercel 요청을 막음) — 로컬에서만 된다
// 구글 지도 사진(/api/gphoto)은 원본 그대로: 못 받은 날의 대체 그림이 최적화 서버에 7일 남지 않게 (10/30)
export const canOptimize = (src: string) =>
  (src.startsWith("/") && !src.startsWith("/api/gphoto/")) || /^https:\/\/(tong\.visitkorea\.or\.kr|thumb\.wikimedia\.org|upload\.wikimedia\.org)\//.test(src);
