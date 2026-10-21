"use client";

// 돈이 오가는 버튼(결제·해지·환불) 앞의 확인 창. 모바일은 아래에서 올라오는 시트, 넓은 화면은 가운데 창 (ui/sheet, Radix Dialog).
// agree를 주면 그 문장에 체크해야 확인 버튼이 눌린다 (정기결제 동의 등)
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

export function ConfirmSheet({
  title,
  lines,
  agree,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  lines: string[];
  agree?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState(!agree);

  return (
    <Sheet open onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent onEscapeKeyDown={(e) => busy && e.preventDefault()} onPointerDownOutside={(e) => busy && e.preventDefault()}>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription asChild>
          <ul className="space-y-1.5">
            {lines.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="text-gray-500">·</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </SheetDescription>
        {agree && (
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-gray-50 p-3.5 text-sm font-semibold ring-1 ring-gray-100">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>{agree}</span>
          </label>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={onClose} className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700">
            {t("취소")}
          </button>
          <button
            disabled={busy || !agreed}
            onClick={onConfirm}
            className={cn("rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-40", danger ? "bg-red-600" : "bg-indigo-600")}
          >
            {busy ? t("처리 중…") : confirmLabel}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
