import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
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
        <div className="mx-auto min-h-dvh max-w-md bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-sm">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
