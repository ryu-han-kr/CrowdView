import type { MetadataRoute } from "next";

// 홈 화면에 추가(PWA). iOS 사파리는 홈 화면에 추가한 앱에서만 웹 푸시 알림을 받을 수 있다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrowdView - 실시간 혼잡도",
    short_name: "CrowdView",
    description: "공항·놀이공원·명소·축제의 실시간 혼잡도와 예측",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
