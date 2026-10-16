import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { AdRail } from "@/components/AdRail";
import { BottomNav, TopNav } from "@/components/BottomNav";
import { NavProgress } from "@/components/NavProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { I18nProvider } from "@/i18n/client";
import { LANGS, isLang } from "@/i18n/config";
import { getDict, getT } from "@/i18n/server";
import { SITE, pageMeta } from "@/lib/seo";
import "../globals.css";

// 언어별로 미리 만들고, 그 외 언어 주소는 404
export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(lang);
  const description = t("공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측");
  return {
    // 공유 링크 미리보기·정식 주소 기준
    metadataBase: new URL(SITE),
    title: { default: `CrowdView - ${t("실시간 혼잡도")}`, template: "%s | CrowdView" },
    description,
    applicationName: "CrowdView",
    keywords: [t("혼잡도"), t("실시간 인구"), t("인천공항 출국장 혼잡도"), t("축제"), t("놀이공원 대기시간"), t("서울 실시간 도시데이터")],
    // 페이지별 정식 주소·언어별 주소는 각 페이지가 pageMeta()로 넣는다 (proxy.ts도 Link 헤더로 알려준다)
    ...pageMeta({ lang, path: "/", description }),
    alternates: undefined,
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      other: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
        ? { "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION }
        : undefined,
    },
    formatDetection: { telephone: false },
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
            {/* 태블릿·PC는 모든 페이지 아래에, 모바일은 마이 탭 아래에 (앱 화면 유지) */}
            <SiteFooter lang={lang} className="mt-10 hidden md:block" />
          </div>
          <AdRail side="left" />
          <AdRail side="right" />
          <BottomNav />
        </I18nProvider>
      </body>
    </html>
  );
}
