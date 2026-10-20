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
    // 만들어 주는 크기를 줄인다: Vercel은 원본 × 크기 × 품질 조합마다 변환 요금을 받는다 (기본 16가지 크기 → 7가지).
    // 누가 /_next/image?w= 를 바꿔 가며 불러도 이 크기들 중 하나로만 맞춰진다
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [96, 256, 384],
    qualities: [75],
  },
  // 글꼴 파일은 폴더 이름에 버전이 있어 내용이 바뀌지 않으므로 1년 보관
  async headers() {
    return [{ source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
