"use client";

// 돈이 오가는 버튼(결제·해지·환불) 앞의 확인 창. 모바일은 아래에서 올라오는 시트, 넓은 화면은 가운데 창.
// agree를 주면 그 문장에 체크해야 확인 버튼이 눌린다 (정기결제 동의 등)
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 text-left text-gray-900 shadow-xl md:rounded-3xl md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
          {lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="text-gray-400">·</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
        {agree && (
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-2xl bg-gray-50 p-3 text-sm font-semibold">
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
            className={`rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-40 ${danger ? "bg-red-600" : "bg-indigo-600"}`}
          >
            {busy ? t("처리 중…") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
