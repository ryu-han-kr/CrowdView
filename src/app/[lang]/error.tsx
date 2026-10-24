"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import Link from "@/i18n/link";
import { pathCharacter } from "@/lib/characters";
import { Character } from "@/components/Character";

/**
 * 화면을 그리다 오류가 났을 때 (사용자 10/24: 오류 화면도 캐릭터로). 그 화면 주제 캐릭터가 우는 모습 + 다시 시도.
 * 서버 오류는 instrumentation이 이미 알리고, 여기서는 브라우저 쪽 오류를 /api/log 로 보낸다 (ErrorReporter와 같은 길)
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/";
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const body = JSON.stringify({ message: `오류 화면: ${message}`.slice(0, 300), stack: error instanceof Error ? error.stack : undefined, url: pathname });
    fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [error, pathname]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-5 text-center">
      <Character name={pathCharacter(pathname)} pose="packed" size={160} priority />
      <h1 className="text-lg font-bold">{t("앗, 화면을 불러오지 못했어요")}</h1>
      <p className="text-sm text-gray-500">{t("잠시 뒤 다시 시도해 주세요. 계속되면 다른 화면을 먼저 둘러보세요.")}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => retry()} className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
          {t("다시 시도")}
        </button>
        <Link href="/" className="rounded-full bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-800">
          {t("홈으로")}
        </Link>
      </div>
      {digest && <p className="mt-2 text-[11px] text-gray-400">{t("오류 번호 {id}", { id: digest })}</p>}
    </main>
  );
}
