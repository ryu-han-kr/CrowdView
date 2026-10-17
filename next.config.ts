import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 비용 리포트 PDF에 쓰는 한글 폰트를 함수 번들에 포함
  outputFileTracingIncludes: {
    "/api/cron/cost-report": ["./assets/fonts/*.ttf"],
  },
  // 관광공사 사진을 화면 크기에 맞게 줄여(WebP·AVIF) 보낸다. 원본은 수백 KB라 홈·카드가 무거웠다.
  // 사진은 잘 안 바뀌어서 7일 보관 (lib/img.ts canOptimize와 같은 목록). 서울시 문화 사이트 사진은 최적화 서버로 받아지지 않아 원본 그대로
  images: {
    remotePatterns: [new URL("https://tong.visitkorea.or.kr/**")],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 7 * 24 * 3600,
  },
};

export default nextConfig;
