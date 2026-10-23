// next/image로 줄여 보낼 수 있는 사진인지 (next.config.ts images.remotePatterns와 같은 목록). 아니면 원본 그대로.
// 서울시 문화 사이트(culture.seoul.go.kr) 사진도 된다 (10/23: 막혔던 건 차단이 아니라 ? 가 있는 주소를 허용 목록이 받지 않아서였다)
export const canOptimize = (src: string) =>
  src.startsWith("/") || /^https:\/\/(tong\.visitkorea\.or\.kr|thumb\.wikimedia\.org|upload\.wikimedia\.org)\//.test(src) ||
  src.startsWith("https://culture.seoul.go.kr/cmmn/file/getImage.do");
