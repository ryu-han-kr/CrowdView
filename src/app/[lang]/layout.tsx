import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { AdRail } from "@/components/AdRail";
import { BottomNav, TopNav } from "@/components/BottomNav";
import { NavProgress } from "@/components/NavProgress";
import { I18nProvider } from "@/i18n/client";
import { LANGS, isLang } from "@/i18n/config";
import { getDict, getT } from "@/i18n/server";
import "../globals.css";

// 언어별로 미리 만들고, 그 외 언어 주소는 404
export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(lang);
  return {
    // 공유 링크 미리보기·정식 주소 기준
    metadataBase: new URL("https://crowdview.app"),
    title: "CrowdView",
    description: t("공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측"),
    // 언어별 주소(hreflang)는 페이지마다 다르므로 proxy.ts가 Link 헤더로 알려준다
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans antialiased">
        <I18nProvider lang={lang} dict={getDict(lang)}>
          <NavProgress />
          <TopNav />
          {/* 모바일: 가운데 448px 앱 화면 그대로 / 태블릿·PC: 넓은 웹 화면 */}
          <div className="mx-auto min-h-dvh max-w-md bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-sm md:max-w-6xl md:px-6 md:pb-16 md:shadow-none">
            {children}
          </div>
          <AdRail side="left" />
          <AdRail side="right" />
          <BottomNav />
        </I18nProvider>
      </body>
    </html>
  );
}
