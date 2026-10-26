// 네이버 지도 SDK 주소 — 서버 컴포넌트(지도 화면 preload 링크)와 브라우저(lib/naver-map) 양쪽에서 쓴다. "use client" 없음
export const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

/** 지도 글자 언어 (네이버 지도는 ko·en·ja·zh 지원) */
export const mapLanguage = (lang: string) => (lang.startsWith("zh") ? "zh" : lang);

/** SDK 주소 (지도 화면은 이 주소를 <link rel="preload">로 미리 받는다) */
export const sdkUrl = (keyId: string, lang: string) => `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}&language=${mapLanguage(lang)}`;
