import type { Metadata, Viewport } from "next";
import { AdRail } from "@/components/AdRail";
import { BottomNav, TopNav } from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  // 공유 링크 미리보기·정식 주소 기준
  metadataBase: new URL("https://crowdview.app"),
  title: "CrowdView Pulse",
  description: "테마파크·여행지·이벤트 실시간 혼잡도와 AI 예측",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans antialiased">
        <TopNav />
        {/* 모바일: 가운데 448px 앱 화면 그대로 / 태블릿·PC: 넓은 웹 화면 */}
        <div className="mx-auto min-h-dvh max-w-md bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-sm md:max-w-6xl md:px-6 md:pb-16 md:shadow-none">
          {children}
        </div>
        <AdRail side="left" />
        <AdRail side="right" />
        <BottomNav />
      </body>
    </html>
  );
}
