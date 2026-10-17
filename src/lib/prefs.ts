"use client";

// 즐겨찾기·선호 카테고리 (로그인 연동 전까지 localStorage 저장)
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const EMPTY = "[]";

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function useStoredList(key: string): [string[], (next: string[]) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) ?? EMPTY,
    () => EMPTY,
  );
  const list = JSON.parse(raw) as string[];
  const set = useCallback(
    (next: string[]) => {
      localStorage.setItem(key, JSON.stringify(next));
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [list, set];
}

export function useFavorites() {
  const [list, set] = useStoredList("cv:favorites");
  const toggle = (id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return { favorites: list, isFavorite: (id: string) => list.includes(id), toggle, replace: set };
}

export function usePreferredTags() {
  const [list, set] = useStoredList("cv:tags");
  const toggle = (tag: string) => set(list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]);
  return { tags: list, toggle, setTags: set };
}

/** 여행 담기: 서울 실시간·여행 가이드에서 가고 싶은 곳을 모아 두는 목록 (왼쪽 정리 패널에 보인다) */
export interface Pick {
  id: string;
  label: string;
  href: string;
}

export function usePicks() {
  const [raw, set] = useStoredList("cv:picks");
  const picks = raw as unknown as Pick[];
  const save = (next: Pick[]) => set(next as unknown as string[]);
  const has = (id: string) => picks.some((p) => p.id === id);
  const toggle = (p: Pick) => save(has(p.id) ? picks.filter((x) => x.id !== p.id) : [...picks, p]);
  return { picks, has, toggle, remove: (id: string) => save(picks.filter((x) => x.id !== id)), clear: () => save([]), replace: save };
}

/** 내 여행 계획: 추천 코스에서 저장한 코스 (공유 링크 /r/{id}는 30일 보관) */
export interface SavedPlan {
  /** 공유 id */
  id: string;
  /** 출발지 이름 */
  start: string;
  /** 출발 날짜 (YYYY-MM-DD, 한국 시각) */
  day: string;
  /** 들르는 곳 이름 (식사 제외) */
  stops: string[];
  savedAt: string;
}

export function usePlans() {
  const [raw, set] = useStoredList("cv:plans");
  const plans = raw as unknown as SavedPlan[];
  const save = (next: SavedPlan[]) => set(next as unknown as string[]);
  const has = (id: string) => plans.some((p) => p.id === id);
  return {
    plans,
    has,
    // 최근 것이 위로, 최대 30개
    add: (p: SavedPlan) => save([p, ...plans.filter((x) => x.id !== p.id)].slice(0, 30)),
    remove: (id: string) => save(plans.filter((x) => x.id !== id)),
    replace: save,
  };
}
