import type { MetadataRoute } from "next";

// 홈 화면에 추가(PWA). iOS 사파리는 홈 화면에 추가한 앱에서만 웹 푸시 알림을 받을 수 있다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrowdView - 실시간 혼잡도",
    short_name: "CrowdView",
    description: "공항·놀이공원·명소·축제의 실시간 혼잡도와 예측",
    // 앱 출시(10/27): 안드로이드는 이 매니페스트로 TWA(신뢰할 수 있는 웹 활동) 앱을 만든다 (docs/앱-출시-준비-2026-10-27.md)
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    dir: "ltr",
    categories: ["travel", "navigation", "lifestyle"],
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드 앱 아이콘은 원·둥근 네모 등으로 잘린다 → 가장자리까지 배경을 채우고 막대를 안쪽 80%에 둔 그림
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "지도", url: "/map", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "공항", url: "/airport", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
