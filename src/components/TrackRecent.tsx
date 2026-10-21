"use client";

import { useEffect } from "react";
import { useRecent } from "@/lib/prefs";

/** 상세 화면에 넣어 두면 '최근 본 곳'에 기록한다 (화면에는 아무것도 그리지 않는다) */
export function TrackRecent({ id, href, title, img, sub }: { id: string; href: string; title: string; img?: string; sub?: string }) {
  const { add } = useRecent();
  useEffect(() => {
    add({ id, href, title, img, sub });
    // add는 저장 목록이 바뀔 때마다 새로 만들어진다 — 상세 화면이 열릴 때 한 번만 기록하면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}
