// 언어 주소 처리: 한국어는 접두사 없이(/map) 쓰고 내부적으로 /ko/map 으로 넘긴다.
// /en /ja /zh-CN /zh-TW 는 그대로, /ko/... 로 들어오면 접두사 없는 주소로 보낸다.
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LANG, LANGS, isLang, localePath, stripLang, type Lang } from "./i18n/config";

const SITE = "https://crowdview.app";

/** 검색엔진용: 이 페이지의 언어별 주소 (HTTP Link 헤더 hreflang) */
function withAlternates(res: NextResponse, path: string): NextResponse {
  const links = LANGS.map((l) => `<${SITE}${localePath(l, path)}>; rel="alternate"; hreflang="${l}"`);
  links.push(`<${SITE}${path}>; rel="alternate"; hreflang="x-default"`);
  res.headers.set("Link", links.join(", "));
  return res;
}

// 검색 로봇·미리보기 봇은 언어를 바꾸지 않는다 (구글 로봇은 미국 IP라 영어로 보내면 한국어 페이지가 색인에서 빠진다)
const BOT = /bot|crawl|spider|slurp|yeti|daum|bingpreview|facebookexternalhit|kakaotalk-scrap|embedly|lighthouse|headless|preview/i;

// 접속 국가 → 기본 언어 (Vercel·Cloudflare 등 어디서든 쓰도록 국가 헤더 여러 개를 본다)
const COUNTRY_LANG: Record<string, Lang> = { KR: "ko", JP: "ja", CN: "zh-CN", TW: "zh-TW", HK: "zh-TW", MO: "zh-TW" };

/** 처음 온 사람의 언어: 국가 기준, 단 브라우저 1순위 언어가 한국어면 한국어 */
function guessLang(request: NextRequest): Lang {
  const accept = (request.headers.get("accept-language") ?? "").toLowerCase();
  if (accept.startsWith("ko")) return "ko";
  const country = (
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("cloudfront-viewer-country") ??
    ""
  ).toUpperCase();
  if (!country) return DEFAULT_LANG;
  return COUNTRY_LANG[country] ?? "en";
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
  // 언어 선택에서 다른 언어를 고른 적 있으면 (쿠키) 그 언어, 처음 온 해외 이용자는 접속 국가 언어로 보낸다
  const saved = request.cookies.get("cv-lang")?.value;
  const target = isLang(saved) ? saved : BOT.test(request.headers.get("user-agent") ?? "") ? DEFAULT_LANG : guessLang(request);
  if (target !== DEFAULT_LANG) {
    url.pathname = localePath(target, pathname);
    return NextResponse.redirect(url, 307);
  }
  url.pathname = `/${DEFAULT_LANG}${pathname === "/" ? "" : pathname}`;
  return withAlternates(NextResponse.rewrite(url), pathname);
}

export const config = {
  // API·정적 파일·이미지·Next 내부 경로는 건드리지 않는다
  matcher: ["/((?!api|_next|places|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
