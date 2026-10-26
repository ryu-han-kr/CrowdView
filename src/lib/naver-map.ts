"use client";

// 네이버 지도 SDK 불러오기 (혼잡도 지도·목록 지도 공통). 키가 없으면 부르는 쪽이 대체 화면을 쓴다
declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

import { KEY_ID, sdkUrl } from "./naver-map-url";
export { KEY_ID, sdkUrl };
const SCRIPT_ID = "naver-maps-sdk";

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

