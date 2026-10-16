"use client";

import { useSyncExternalStore } from "react";

// Plus 회원 여부 (광고 숨김 등). 로그인·결제가 붙으면 서버가 cv-plus 쿠키를 심는다 (값은 서버에서 검증하고, 여기서는 화면 표시용으로만 쓴다)
const read = () => (typeof document !== "undefined" && /(?:^|;\s*)cv-plus=1(?:;|$)/.test(document.cookie)) || false;

export function usePlus(): boolean {
  return useSyncExternalStore(
    () => () => {},
    read,
    () => false,
  );
}
