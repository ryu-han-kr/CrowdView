import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 응답 헤더에 프레임워크 이름을 싣지 않는다 (x-powered-by)
  poweredByHeader: false,
  // 비용 리포트 PDF에 쓰는 한글 폰트를 함수 번들에 포함
  outputFileTracingIncludes: {
    "/api/cron/cost-report": ["./assets/fonts/*.ttf"],
  },
  // 관광공사 사진을 화면 크기에 맞게 줄여(WebP·AVIF) 보낸다. 원본은 수백 KB라 홈·카드가 무거웠다.
  // 사진은 잘 안 바뀌어서 7일 보관 (lib/img.ts canOptimize와 같은 목록). 서울시 문화 사이트 사진도 (아래 remotePatterns)
  images: {
    // 위키미디어 커먼즈: 장소 사진 (src/data/korea/place-photos.json, CC0·CC BY·CC BY-SA·공유 저작물만, 10/22)
    remotePatterns: [
      new URL("https://tong.visitkorea.or.kr/**"),
      new URL("https://thumb.wikimedia.org/**"),
      new URL("https://upload.wikimedia.org/**"),
      // 서울시 문화행사 사진 (getImage.do?atchFileId=…). 주소에 ? 가 있어 new URL 방식(검색어 없음만 허용)으로는 막혔다 (10/23).
      // search를 비워 두면 어떤 검색어든 허용 → 원본 최대 786KB 포스터를 줄여 보낸다
      { protocol: "https", hostname: "culture.seoul.go.kr", pathname: "/cmmn/file/getImage.do" },
    ],
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
    return [
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // 보안 헤더 (QA 10/21): 남의 사이트가 우리 화면(결제 확인 창 등)을 틀에 넣어 속이지 못하게, 파일 종류 추측 막기,
      // 다른 사이트로 넘어갈 때 주소 전체를 보내지 않기, 카메라·마이크 끄기(위치는 '근처' 기능 때문에 우리 사이트만).
      // 전체 CSP는 지도·결제·광고 스크립트가 많아 뒤로 미룬다 (frame-ancestors만)
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
