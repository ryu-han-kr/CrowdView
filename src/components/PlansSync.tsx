"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { usePlans, type SavedPlan } from "@/lib/prefs";

/**
 * 로그인하면 이 기기의 저장한 여행 계획과 서버의 것을 합치고, 이후 바뀔 때마다 서버에 저장한다 (찜 동기화와 같은 방식).
 * 로그인하지 않으면 기기에만 저장된다
 */
export function PlansSync() {
  const { data } = useSession();
  const { plans: picks, replace } = usePlans();
  const userId = data?.user?.id;
  const merged = useRef<string | null>(null);
  const key = JSON.stringify(picks.map((p) => p.id));

  // 로그인 직후 한 번: 서버 + 기기 합치기 (서버 순서 먼저, 기기에만 있는 것은 뒤에)
  useEffect(() => {
    if (!userId || merged.current === userId) return;
    merged.current = userId;
    (async () => {
      const res = await fetch("/api/me/plans").catch(() => null);
      if (!res?.ok) return;
      const server = ((await res.json()) as { plans: SavedPlan[] }).plans;
      const union = [...server, ...picks.filter((p) => !server.some((s) => s.id === p.id))];
      if (union.length !== picks.length || union.some((p, i) => p.id !== picks[i]?.id)) replace(union);
      if (union.length !== server.length) await save(union);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 이후 바뀌면 저장 (1초 모아서)
  useEffect(() => {
    if (!userId || merged.current !== userId) return;
    const id = setTimeout(() => save(picks), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);

  return null;
}

function save(picks: SavedPlan[]) {
  return fetch("/api/me/plans", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plans: picks }),
  }).catch(() => {});
}
