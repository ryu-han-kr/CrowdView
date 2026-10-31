"use client";

// 통합 검색 자료 (/api/home-search/{lang}, 5분 CDN 캐시). 홈 목록과 맨 위 검색창 드롭다운이 같이 쓴다 — 언어별로 한 번만 받는다
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { SearchData } from "@/components/HomeList";

const searchPromise: Record<string, Promise<SearchData | undefined>> = {};

export function useHomeSearch(enabled: boolean): SearchData | undefined {
  const { lang } = useI18n();
  const [data, setData] = useState<SearchData>();
  useEffect(() => {
    if (!enabled) return;
    searchPromise[lang] ??= fetch(`/api/home-search/${lang}`)
      .then((r) => (r.ok ? r.json() : undefined))
      .catch(() => undefined);
    searchPromise[lang].then(setData);
  }, [lang, enabled]);
  return data;
}
