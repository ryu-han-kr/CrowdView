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

/** 최근 본 곳: 장소·서울 지역·축제 상세를 열면 기록 (홈 '최근 본 곳' 줄, NOL 레퍼런스 10/21). 이 기기에만, 최대 12개 */
export interface Recent {
  id: string;
  href: string;
  title: string;
  img?: string;
  sub?: string;
  /** 마지막으로 본 시각 (ms) */
  at: number;
}
const RECENT_MAX = 12;

export function useRecent() {
  const [raw, set] = useStoredList("cv:recent");
  const recent = (raw as unknown as Recent[]).filter((r) => r && r.id && r.href);
  const save = (next: Recent[]) => set(next as unknown as string[]);
  const add = (r: Omit<Recent, "at">) => {
    // 저장소를 바로 읽는다: 하이드레이션 직후 effect에서는 훅의 목록이 아직 서버 값([])이라 그대로 쓰면 기록을 덮어쓴다
    let cur: Recent[] = [];
    try {
      cur = (JSON.parse(localStorage.getItem("cv:recent") ?? EMPTY) as Recent[]).filter((x) => x && x.id && x.href);
    } catch {
      cur = [];
    }
    // 같은 곳을 다시 열었을 때 순서·내용이 같으면 저장하지 않는다 (렌더링 때마다 쓰지 않게)
    if (cur[0]?.id === r.id && cur[0].title === r.title && cur[0].img === r.img) return;
    save([{ ...r, at: Date.now() }, ...cur.filter((x) => x.id !== r.id)].slice(0, RECENT_MAX));
  };
  return { recent, add, clear: () => save([]) };
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
