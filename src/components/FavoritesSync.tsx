"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { useFavorites } from "@/lib/prefs";

/**
 * 로그인하면 이 기기의 찜과 서버의 찜을 합치고, 이후 바뀔 때마다 서버에 저장한다.
 * 로그인하지 않으면 지금처럼 기기에만 저장된다.
 */
export function FavoritesSync() {
  const { data } = useSession();
  const { favorites, replace } = useFavorites();
  const userId = data?.user?.id;
  const merged = useRef<string | null>(null);
  const key = favorites.join(",");

  // 로그인 직후 한 번: 서버 + 기기 합치기
  useEffect(() => {
    if (!userId || merged.current === userId) return;
    merged.current = userId;
    (async () => {
      const res = await fetch("/api/me/favorites").catch(() => null);
      if (!res?.ok) return;
      const server = ((await res.json()) as { ids: string[] }).ids;
      const union = [...new Set([...server, ...favorites])];
      if (union.join(",") !== favorites.join(",")) replace(union);
      if (union.length !== server.length) await save(union);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 이후 찜이 바뀌면 저장 (1초 모아서)
  useEffect(() => {
    if (!userId || merged.current !== userId) return;
    const id = setTimeout(() => save(key ? key.split(",") : []), 1000);
    return () => clearTimeout(id);
  }, [userId, key]);

  return null;
}

function save(ids: string[]) {
  return fetch("/api/me/favorites", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
}
