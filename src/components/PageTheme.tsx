"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// 주소의 첫 경로로 페이지 종류를 정해 body[data-page]에 둔다 → globals.css가 위쪽 그라데이션 색을 바꾼다
const PAGES: Record<string, string> = {
  map: "map",
  explore: "explore",
  spot: "explore",
  festival: "explore",
  events: "explore",
  guide: "guide",
  near: "guide",
  route: "route",
  r: "route",
  seoul: "seoul",
  me: "me",
  plus: "me",
  pricing: "me",
};

export function PageTheme() {
  const path = usePathname();
  useEffect(() => {
    const parts = path.split("/").filter(Boolean);
    // 언어 접두사(/en 등)는 건너뛴다
    const first = /^(en|ja|zh-CN|zh-TW|ko)$/.test(parts[0] ?? "") ? parts[1] : parts[0];
    // 홈(주소 첫 경로 없음)만 "home" — 머리 색 띠가 장소 화면 등에 깔리지 않게 (10/22)
    document.body.dataset.page = first ? (PAGES[first] ?? "other") : "home";
  }, [path]);
  return null;
}
