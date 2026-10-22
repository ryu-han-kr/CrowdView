// 분류마다 색·3D 아이콘 (사용자 QA 10/22: 사진이 비슷해 구별이 어렵다 → 사진 위에 분류 꼬리표를 색·아이콘으로)
// 아이콘: public/icons/3d (Microsoft Fluent Emoji 3D, MIT)
import type { Category } from "./types";

export const CATEGORY_TONE: Record<Category, { color: string; icon: string }> = {
  landmark: { color: "#4338ca", icon: "landmark" },
  street: { color: "#be185d", icon: "street" },
  themepark: { color: "#c2410c", icon: "rollercoaster" },
  waterpark: { color: "#0e7490", icon: "waterpark" },
  ski: { color: "#1d4ed8", icon: "ski" },
  beach: { color: "#0f766e", icon: "beach" },
  airport: { color: "#0369a1", icon: "airport" },
  event: { color: "#7e22ce", icon: "festival" },
};
