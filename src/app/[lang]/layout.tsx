import { PageTheme } from "@/components/PageTheme";
import { WebVitals } from "@/components/WebVitals";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { AdRail } from "@/components/AdRail";
import { BottomNav, TopNav } from "@/components/BottomNav";
import { NavProgress } from "@/components/NavProgress";
import { ErrorReporter } from "@/components/ErrorReporter";
import { FavoritesSync } from "@/components/FavoritesSync";
import { PicksSync } from "@/components/PicksSync";
import { PlansSync } from "@/components/PlansSync";
import { authEnabled } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";
import { I18nProvider } from "@/i18n/client";
import { LANGS, isLang } from "@/i18n/config";
import { getDict, getT } from "@/i18n/server";
import { SITE, pageMeta } from "@/lib/seo";
import "../globals.css";
import { TrafficBeacon } from "@/components/TrafficBeacon";

// 언어별로 미리 만들고, 그 외 언어 주소는 아래 isLang 검사로 404.
// dynamicParams=false를 두면 하위 페이지(가이드 상세처럼 처음 열 때 만드는 곳)까지 미리 만든 주소만 허용돼 404가 났다
export const dynamicParams = true;
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
      // 네이버 서치어드바이저 · Bing 웹마스터 도구 소유 확인 (값이 있을 때만 meta 태그)
      other: {
        ...(process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION && { "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION }),
        ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION && { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }),
        // 애드센스 사이트 소유 확인 (10/26)
        ...(process.env.NEXT_PUBLIC_ADSENSE_CLIENT && { "google-adsense-account": process.env.NEXT_PUBLIC_ADSENSE_CLIENT }),
      },
    },
    formatDetection: { telephone: false },
    icons: { icon: "/icon-192.png", apple: "/icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

const FONT_CSS = "/fonts/pretendard-1.3.9/pretendard.css";
// 제목 서체 (Wanted Sans Variable, 92조각). 본문 Pretendard와 같은 방식으로 비동기 로드
const HEAD_FONT_CSS = "/fonts/wanted-sans/WantedSansVariable.css";

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* 글꼴 선언(49KB)은 첫 화면을 막지 않게 따로: 미리 받아 두고 아래 스크립트가 붙인다 (스크립트로 붙인 CSS는 화면을 막지 않는다) */}
        <link rel="preload" href={FONT_CSS} as="style" />
        <noscript>
          <link rel="stylesheet" href={FONT_CSS} />
        </noscript>
        {/* 화면 테마(라이트·다크 고정)를 그리기 전에 적용해 깜빡이지 않게. 저장 값이 없으면 시스템 설정(자동) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){["${FONT_CSS}","${HEAD_FONT_CSS}"].forEach(function(h){var l=document.createElement("link");l.rel="stylesheet";l.href=h;document.head.appendChild(l)})})();try{var t=localStorage.getItem("cv:theme");if(t==="dark"||t==="auto")document.documentElement.dataset.theme=t;var f=localStorage.getItem("cv:font");if(f==="l"||f==="xl")document.documentElement.dataset.font=f}catch(e){}if(/(?:^|; *)cv-plus=1(?:;|$)/.test(document.cookie))document.documentElement.dataset.plus="1"`,
          }}
        />
        {/* 관광공사 사진은 주소가 바뀌어 사라지기도 한다(10/20 3,047장 중 236장 404) → 깨진 사진은 숨겨 카드의 색 배경이 보이게 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="IMG")t.style.visibility="hidden"},true)`,
          }}
        />
      </head>
      <body className="relative isolate bg-white font-sans antialiased">
        {/* 구글 애드센스 (발행자 ID가 있을 때만). EEA·영국 이용자 동의 화면은 애드센스 콘솔 '개인 정보 보호 및 메시지'에서 켠다 */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <I18nProvider lang={lang} dict={getDict(lang)}>
          <NavProgress />
          <PageTheme />
          <ErrorReporter />
          <WebVitals />
          <TrafficBeacon />
          <TopNav authEnabled={authEnabled} />
          {authEnabled && <FavoritesSync />}
          {authEnabled && <PicksSync />}
          {authEnabled && <PlansSync />}
          {/* 모바일: 가운데 448px 앱 화면 그대로 / 태블릿·PC: 넓은 웹 화면 */}
          {/* 태블릿·PC: 화면 위쪽 은은한 파랑 그라데이션 (아래로 갈수록 흰색) */}
          <div aria-hidden className="page-glow pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[640px] md:block" />
          <div className="relative isolate mx-auto min-h-dvh max-w-md bg-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-sm md:max-w-6xl md:bg-transparent md:px-6 md:pb-16 md:shadow-none">
            {/* 모바일: 앱 화면 안쪽 위에 같은 그라데이션 */}
            <div aria-hidden className="page-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] md:hidden" />
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
