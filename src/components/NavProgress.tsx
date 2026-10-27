"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { pathCharacter } from "@/lib/characters";
import { Character } from "./Character";

/** 대기 화면을 띄우기까지 (빠른 이동에는 막대만) */
const WAIT_MS = 600;

/**
 * 내부 링크를 누르면 화면 맨 위에 진행 막대를 띄우고, 주소가 바뀌면 지운다 (누른 게 먹혔는지 바로 보이게).
 * 0.6초 넘게 걸리면 가는 화면의 주제 캐릭터가 기다리는 대기 화면을 덮는다 (사용자 10/24).
 * loading.tsx로 만들면 응답이 바로 스트리밍돼 상태 코드가 200으로 고정된다 — 없는 주소가 404 대신 200, 페이지 안 redirect()가
 * HTTP 리다이렉트 대신 브라우저 이동이 됐다 (10/24 #278 운영 확인). 그래서 브라우저 쪽에서만 띄운다
 */
export function NavProgress() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [target, setTarget] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const loading = target !== null;

  useEffect(() => {
    setTarget(null);
    setSlow(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setTarget(url.pathname);
    };
    // 캡처 단계에서 본다: Next Link가 먼저 preventDefault를 불러, 거품 단계에서는 모든 앱 링크가 '취소된 클릭'으로 보여
    // 막대가 한 번도 뜨지 않았다 (10/24 확인)
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 이동이 취소되거나 오래 걸려도 막대가 남지 않게
  useEffect(() => {
    if (!loading) return;
    const slowId = setTimeout(() => setSlow(true), WAIT_MS);
    const id = setTimeout(() => {
      setTarget(null);
      setSlow(false);
    }, 10_000);
    return () => {
      clearTimeout(slowId);
      clearTimeout(id);
    };
  }, [loading]);

  if (!loading) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" role="progressbar" aria-busy="true">
        <div className="nav-progress h-full bg-indigo-500 shadow-[0_0_8px_rgb(99_102_241/0.7)]" />
      </div>
      {slow && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex animate-[fade-in_0.2s_ease-out] flex-col items-center justify-center gap-2 bg-white/85 text-center backdrop-blur-sm dark:bg-gray-950/80">
          <span className="relative inline-block">
            <span aria-hidden className="wait-ring absolute -inset-3 rounded-full border-[3px] border-indigo-100 border-t-indigo-500" />
            <Character name={pathCharacter(target)} pose="wait" size={150} priority className="mascot-bob" />
            <span aria-hidden className="absolute top-3 right-2 text-xl">
              <span className="zzz">z</span>
              <span className="zzz">z</span>
              <span className="zzz">z</span>
            </span>
          </span>
          <p className="text-sm font-semibold text-gray-600">
            {t("잠시만요, 불러오는 중이에요")}
            <span className="loading-dots" aria-hidden="true" />
          </p>
        </div>
      )}
    </>
  );
}
