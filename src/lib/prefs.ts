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
  return { favorites: list, isFavorite: (id: string) => list.includes(id), toggle };
}

export function usePreferredTags() {
  const [list, set] = useStoredList("cv:tags");
  const toggle = (tag: string) => set(list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]);
  return { tags: list, toggle };
}
