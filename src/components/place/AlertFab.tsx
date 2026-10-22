"use client";

import { useEffect, useState } from "react";
import { AlertButtons } from "@/components/AlertButtons";
import { Glyph } from "@/components/Glyph";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/client";
import { CrowdMascot } from "./CrowdMascot";

/**
 * 오른쪽 아래에 떠 있는 혼잡 알림 버튼 (사용자 QA 10/22, 레퍼런스: 트립닷컴 오른쪽 아래 둥근 버튼들).
 * 캐릭터가 지금 단계 표정으로 앉아 있고, 누르면 아래에서 알림 설정 창이 올라온다.
 * 처음 몇 초는 '알림 받기' 말풍선을 함께 보여 준다
 */
export function AlertFab({
  placeId,
  placeName,
  score,
  closed,
  enabled,
}: {
  placeId: string;
  placeName: string;
  score: number;
  closed: boolean;
  enabled: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 6000);
    // 내려 읽기 시작하면 바로 접는다 (UI QA 9차: 말풍선이 본문 글자를 가렸다)
    const onScroll = () => window.scrollY > 300 && setHint(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  if (!enabled) return null;

  return (
    <>
      <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 md:right-8 md:bottom-8">
        {hint && <span className="rounded-full bg-gray-900 px-3 py-1.5 text-sm font-bold text-white shadow-lg">{t("한산해지면 알려 드릴게요")}</span>}
        <button
          onClick={() => {
            setOpen(true);
            setHint(false);
          }}
          aria-label={t("혼잡 알림 설정")}
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_6px_24px_rgb(15_23_42/0.18)] ring-1 ring-gray-200 transition active:scale-95"
        >
          <CrowdMascot score={score} closed={closed} size={50} />
          <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white ring-2 ring-white">
            <Glyph e="🔔" className="h-4 w-4" />
          </span>
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <div className="flex items-center gap-3">
            <CrowdMascot score={score} closed={closed} size={72} />
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
