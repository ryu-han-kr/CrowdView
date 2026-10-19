"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useFavorites, usePicks, type Pick } from "@/lib/prefs";
import { Glyph } from "@/components/Glyph";

/** 링크를 휴대폰 공유창으로 보내고, 공유창이 없으면(PC) 복사한다. 복사했으면 true */
export async function shareUrl(url: string, title: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return false;
    }
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** 마이페이지: 내 즐겨찾기 + 담은 곳을 다른 사람에게 보내는 링크 (/l/{id}, 30일) */
export function ShareListButton() {
  const { t, lp } = useI18n();
  const { favorites } = useFavorites();
  const { picks } = usePicks();
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  if (!favorites.length && !picks.length) return null;
  const share = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ favorites, picks }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      if (!res.ok || !json.id) throw new Error();
      const copied = await shareUrl(`${location.origin}${lp(`/l/${json.id}`)}`, t("내 찜 목록"));
      setState(copied ? "copied" : "idle");
      if (copied) setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  };
  return (
    <button onClick={share} disabled={state === "busy"} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 disabled:opacity-50">
      <Glyph e="🔗" className="h-4 w-4" />
      {state === "copied" ? t("링크를 복사했어요") : state === "error" ? t("다시 시도해 주세요") : t("찜 목록 공유")}
    </button>
  );
}

/** 공유받은 목록을 내 즐겨찾기·담은 곳에 더한다 (이미 있는 건 그대로) */
export function ImportListButton({ favorites, picks }: { favorites: string[]; picks: Pick[] }) {
  const { t } = useI18n();
  const fav = useFavorites();
  const mine = usePicks();
  const [done, setDone] = useState(false);
  const add = () => {
    fav.replace([...fav.favorites, ...favorites.filter((id) => !fav.favorites.includes(id))]);
    mine.replace([...mine.picks, ...picks.filter((p) => !mine.has(p.id))]);
    setDone(true);
  };
  return (
    <button
      onClick={add}
      disabled={done}
      className="mt-6 block w-full rounded-2xl bg-indigo-600 py-3.5 text-center text-sm font-bold text-white disabled:bg-indigo-300"
    >
      {done ? t("내 찜 목록에 담았어요") : t("내 찜 목록에 모두 담기")}
    </button>
  );
}
