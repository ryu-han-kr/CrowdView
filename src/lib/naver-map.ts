"use client";

// 네이버 지도 SDK 불러오기 (혼잡도 지도·목록 지도 공통). 키가 없으면 부르는 쪽이 대체 화면을 쓴다
declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

export const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const SCRIPT_ID = "naver-maps-sdk";

/** 지도 글자 언어 (네이버 지도는 ko·en·ja·zh 지원) */
const mapLanguage = (lang: string) => (lang.startsWith("zh") ? "zh" : lang);

/** SDK 주소 (지도 화면은 이 주소를 <link rel="preload">로 미리 받는다) */
export const sdkUrl = (keyId: string, lang: string) => `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}&language=${mapLanguage(lang)}`;

export function loadSdk(keyId: string, lang: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = sdkUrl(keyId, lang);
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("naver maps sdk load failed")));
  });
}

