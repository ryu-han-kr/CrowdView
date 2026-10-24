"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { pathCharacter } from "@/lib/characters";
import { Character } from "@/components/Character";

/** 화면을 받는 동안 (사용자 10/24: 대기 화면도 캐릭터로). 가는 화면의 주제 캐릭터가 기다리는 모습 */
export default function Loading() {
  const { t } = useI18n();
  const name = pathCharacter(usePathname() ?? "/");
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-5 text-center" aria-busy="true">
      <Character name={name} pose="wait" size={150} priority className="mascot-bob" />
      <p className="text-sm font-semibold text-gray-600">
        {t("잠시만요, 불러오는 중이에요")}
        <span className="loading-dots" aria-hidden="true" />
      </p>
    </main>
  );
}
