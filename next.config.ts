import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 비용 리포트 PDF에 쓰는 한글 폰트를 함수 번들에 포함
  outputFileTracingIncludes: {
    "/api/cron/cost-report": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
