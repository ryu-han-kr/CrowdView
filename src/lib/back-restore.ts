"use client";

// 목록에서 '더 보기'로 늘려 장소를 눌렀다가 뒤로 오면 목록이 첫 12~24곳으로 돌아가고 스크롤도 위로 튀었다 (경수님 QA 11/1).
// 뒤로 온 경우에만 조건·펼친 수를 이 탭(sessionStorage)에서 되살린다. 링크로 새로 들어오면 처음부터.
import { useEffect, useRef, useState } from "react";

const PREFIX = "cv:back:";
// 라우터가 화면을 받아 오는 동안 기다리는 시간. 그 사이 다른 곳을 누르면 바로 꺼진다
const BACK_WINDOW_MS = 15_000;
let backAt = 0;

if (typeof window !== "undefined") {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "back_forward") backAt = Date.now();
  window.addEventListener("popstate", () => (backAt = Date.now()));
  document.addEventListener("click", () => (backAt = 0), true);
}

export const isBackNav = () => backAt > 0 && Date.now() - backAt < BACK_WINDOW_MS;

/** 처음 그린 값은 서버와 같아야 해서, 되살리기는 그린 뒤에 한다 */
export function useBackRestore<T>(name: string, state: T, apply: (saved: T) => void) {
  const started = useRef(false);
  const skipWrite = useRef(false);
  const json = JSON.stringify(state);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!isBackNav()) return;
    try {
      const raw = sessionStorage.getItem(PREFIX + location.pathname + location.search + ":" + name);
      if (raw) {
        // 되살린 값이 그려지기 전에 처음 값으로 덮어쓰지 않게 한 번 건너뛴다
        skipWrite.current = true;
        apply(JSON.parse(raw) as T);
      }
    } catch {}
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    try {
      sessionStorage.setItem(PREFIX + location.pathname + location.search + ":" + name, json);
    } catch {}
  }, [name, json]);
}

export interface PagedState {
  sig: string;
  n: number;
}

/** 조건(sig)이 바뀌면 처음 수로. 조건과 수를 함께 들고 있어, 되살릴 때 '조건이 바뀌었으니 처음으로'에 지워지지 않는다 */
export function usePaged(page: number, sig: string) {
  const [state, setState] = useState<PagedState>({ sig, n: page });
  const shown = state.sig === sig ? state.n : page;
  return { shown, more: () => setState({ sig, n: shown + page }), state, restore: setState };
}
