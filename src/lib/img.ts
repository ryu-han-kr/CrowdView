// next/image로 줄여 보낼 수 있는 사진인지 (next.config.ts images.remotePatterns와 같은 목록). 아니면 원본 그대로.
// 서울시 문화 사이트(culture.seoul.go.kr) 사진은 최적화 서버가 받지 못해(차단) 원본으로 둔다
export const canOptimize = (src: string) =>
  src.startsWith("/") || /^https:\/\/(tong\.visitkorea\.or\.kr|thumb\.wikimedia\.org|upload\.wikimedia\.org)\//.test(src);
