"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * 검색어를 주소(?q=)에 함께 둔다 (QA 10/21 HOME-07·UX-08): 상세에 갔다가 뒤로 오거나 새로고침해도 같은 검색 결과.
 * 페이지가 캐시(ISR)라 서버는 검색어를 모른다 → 처음 그린 뒤 브라우저 주소에서 읽고, 바뀔 때마다 기록 없이(replaceState) 고친다.
 * 값은 param 별 공용 저장소에 둔다 (10/27 홈 2차: 휴대폰 머리의 검색창과 목록이 같은 검색어를 쓴다)
 */
interface Store {
  value: string;
  subs: Set<() => void>;
}
const stores = new Map<string, Store>();
const storeOf = (param: string): Store => {
  let s = stores.get(param);
  if (!s) {
    s = { value: "", subs: new Set() };
    stores.set(param, s);
  }
  return s;
};
const publish = (s: Store, v: string) => {
  if (s.value === v) return;
  s.value = v;
  s.subs.forEach((f) => f());
};

export function useUrlQuery(param = "q"): [string, (v: string) => void] {
  const s = storeOf(param);
  const value = useSyncExternalStore(
    (cb) => {
      s.subs.add(cb);
      return () => {
        s.subs.delete(cb);
      };
    },
    () => s.value,
    () => "",
  );
  // 화면이 바뀌면(다른 화면도 같은 param 을 쓴다) 그 화면 주소의 값으로 맞춘다
  useEffect(() => {
    publish(s, new URLSearchParams(location.search).get(param) ?? "");
  }, [param, s]);
  const set = (v: string) => {
    publish(s, v);
    const url = new URL(location.href);
    if (v) url.searchParams.set(param, v);
    else url.searchParams.delete(param);
    // Next 라우터가 쓰는 history.state를 그대로 두고 주소만 바꾼다
    history.replaceState(history.state, "", url);
  };
  return [value, set];
}
