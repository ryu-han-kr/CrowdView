"use client";

import { useI18n } from "@/i18n/client";
import { SHOW_DATA_LABELS, type DataKind } from "@/lib/format";

/** 실데이터가 아닌 값 옆의 (추정)·(임의) 표시. 출시 때 NEXT_PUBLIC_DATA_LABELS=off 로 끈다 */
export function DataTag({ kind = "추정", className = "" }: { kind?: DataKind; className?: string }) {
  const { t } = useI18n();
  if (!SHOW_DATA_LABELS) return null;
  return (
    <span
      className={`ml-1 inline-block align-middle text-[10px] font-semibold ${kind === "임의" ? "text-violet-700" : "text-amber-700"} ${className}`}
      title={kind === "임의" ? t("직접 넣은 샘플 값이에요") : t("실데이터가 아닌 계산·예측 값이에요")}
    >
      ({t(kind)})
    </span>
  );
}
