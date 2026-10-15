// 언어 주소 처리: 한국어는 접두사 없이(/map) 쓰고 내부적으로 /ko/map 으로 넘긴다.
// /en /ja /zh-CN /zh-TW 는 그대로, /ko/... 로 들어오면 접두사 없는 주소로 보낸다.
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG, LANGS, isLang, localePath, stripLang } from "./i18n/config";

const SITE = "https://crowdview.app";

/** 검색엔진용: 이 페이지의 언어별 주소 (HTTP Link 헤더 hreflang) */
function withAlternates(res: NextResponse, path: string): NextResponse {
  const links = LANGS.map((l) => `<${SITE}${localePath(l, path)}>; rel="alternate"; hreflang="${l}"`);
  links.push(`<${SITE}${path}>; rel="alternate"; hreflang="x-default"`);
  res.headers.set("Link", links.join(", "));
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const seg = pathname.split("/")[1];
  if (seg === DEFAULT_LANG) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LANG.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (isLang(seg)) return withAlternates(NextResponse.next(), stripLang(pathname).path);
  const url = request.nextUrl.clone();
  // 언어 선택에서 다른 언어를 고른 적 있으면 (쿠키) 그 언어 주소로 보낸다
  const saved = request.cookies.get("cv-lang")?.value;
  if (isLang(saved) && saved !== DEFAULT_LANG) {
    url.pathname = localePath(saved, pathname);
    return NextResponse.redirect(url, 307);
  }
  url.pathname = `/${DEFAULT_LANG}${pathname === "/" ? "" : pathname}`;
  return withAlternates(NextResponse.rewrite(url), pathname);
}

export const config = {
  // API·정적 파일·이미지·Next 내부 경로는 건드리지 않는다
  matcher: ["/((?!api|_next|places|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
