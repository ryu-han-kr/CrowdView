// 이용 집계용 페이지 종류 (브라우저 TrafficBeacon과 서버 lib/traffic이 함께 쓴다 — Redis 코드가 브라우저로 가지 않게 따로 둔다)
/** 페이지 종류 (주소 첫 칸). 어느 화면으로 들어와 다음 화면으로 넘어가는지 보려고 (사용자 10/26: 1명 1페이지) */
export const PAGE_TYPES = ["home", "place", "spot", "guide", "festival", "events", "seoul", "airport", "explore", "map", "route", "near", "me", "plus", "other"] as const;

/** 주소 → 페이지 종류 (언어 앞칸은 뗀다) */
export function pageType(pathname: string): string {
  const seg = pathname.replace(/^\/(en|ja|zh-CN|zh-TW)(?=\/|$)/, "").split("/")[1] ?? "";
  if (!seg) return "home";
  return (PAGE_TYPES as readonly string[]).includes(seg) ? seg : "other";
}
