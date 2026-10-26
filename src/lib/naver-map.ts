"use client";

// 네이버 지도 SDK 불러오기 (혼잡도 지도·목록 지도 공통). 키가 없으면 부르는 쪽이 대체 화면을 쓴다
declare global {
  interface Window {
    naver?: any;
    navermap_authFailure?: () => void;
  }
}

import { preconnect } from "react-dom";
import { KEY_ID, sdkUrl } from "./naver-map-url";
export { KEY_ID, sdkUrl };
const SCRIPT_ID = "naver-maps-sdk";

export function loadSdk(keyId: string, lang: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  // 타일 서버에 미리 연결. 지도 화면 <head>에 preload 링크를 두면 Next가 다른 화면에서 /map을 미리 가져올 때(prefetch) SDK 92KB까지 받아 버려(10/26 홈에서 확인) 여기서만 한다
  preconnect("https://nrbe.pstatic.net", { crossOrigin: "anonymous" });
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

