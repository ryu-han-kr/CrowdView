"use client";

import { useEffect, useState } from "react";

/**
 * 검색어를 주소(?q=)에 함께 둔다 (QA 10/21 HOME-07·UX-08): 상세에 갔다가 뒤로 오거나 새로고침해도 같은 검색 결과.
 * 페이지가 캐시(ISR)라 서버는 검색어를 모른다 → 처음 그린 뒤 브라우저 주소에서 읽고, 바뀔 때마다 기록 없이(replaceState) 고친다
 */
export function useUrlQuery(param = "q"): [string, (v: string) => void] {
  const [value, setValue] = useState("");
  useEffect(() => {
    const v = new URLSearchParams(location.search).get(param);
    if (v) setValue(v);
  }, [param]);
  const set = (v: string) => {
    setValue(v);
    const url = new URL(location.href);
    if (v) url.searchParams.set(param, v);
    else url.searchParams.delete(param);
    // Next 라우터가 쓰는 history.state를 그대로 두고 주소만 바꾼다
    history.replaceState(history.state, "", url);
  };
  return [value, set];
}
