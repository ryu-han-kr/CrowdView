// 분류마다 색·3D 아이콘 (사용자 QA 10/22: 사진이 비슷해 구별이 어렵다 → 사진 위에 분류 꼬리표를 색·아이콘으로)
// 아이콘: public/icons/3d (Microsoft Fluent Emoji 3D, MIT)
import { CATEGORY_LABEL, type Category } from "./types";
import { SUB_ICON, SUB_LABEL, subOf } from "./subcategory";

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

/** 카드 꼬리표: 세부 분류가 있으면 그 이름·아이콘 (예: 테마파크 → 아쿠아리움 🐠), 색은 상위 분류 */
export function placeTag(p: { id: string; category: Category }, t: (k: string) => string): { label: string; color: string; icon: string } {
  const sub = subOf(p.id);
  return {
    label: t(sub ? SUB_LABEL[sub] : CATEGORY_LABEL[p.category]),
    color: CATEGORY_TONE[p.category].color,
    icon: (sub && SUB_ICON[sub]) || CATEGORY_TONE[p.category].icon,
  };
}
