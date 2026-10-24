"use client";

import { useState } from "react";
import { AlertButtons } from "@/components/AlertButtons";
import { Glyph } from "@/components/Glyph";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/client";
import type { CharacterName } from "@/lib/characters";
import { Character } from "@/components/Character";

/**
 * 혼잡 알림 버튼. 처음엔 오른쪽 아래에 떠 있었는데, 차트 오른쪽 아래(21시·'시간을 눌러 자세히')를 덮어
 * 그 부분을 누를 수 없었다 (사용자 10/23) → '지금 혼잡도' 카드 안의 줄 버튼으로 옮겼다. 누르면 아래에서 알림 설정 창이 올라온다
 */
export function AlertFab({
  placeId,
  placeName,
  enabled,
  character = "hamster",
}: {
  placeId: string;
  placeName: string;
  enabled: boolean;
  character?: CharacterName;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("혼잡 알림 설정")}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-[15px] font-bold text-white shadow-sm transition active:scale-[0.98]"
      >
        <Glyph e="🔔" className="h-4 w-4" />
        {t("한산해지면 알려 드릴게요")}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <div className="flex items-center gap-3">
            <Character name={character} pose="alert" size={80} className="shrink-0" />
            <div className="min-w-0">
              <SheetTitle>{t("혼잡 알림")}</SheetTitle>
              <SheetDescription className="mt-1">
                {t("{name}이(가) 한산해지거나 붐비기 시작하면 휴대폰으로 알려 드려요.", { name: placeName })}
              </SheetDescription>
            </div>
          </div>
          <AlertButtons placeId={placeId} enabled />
        </SheetContent>
      </Sheet>
    </>
  );
}
