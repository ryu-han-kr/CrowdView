"use client";

import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/client";
import Link from "@/i18n/link";
import { usePlus } from "@/lib/plus-client";
import { PLUS } from "@/lib/business";

export interface ForecastTab {
  id: string;
  label: string;
  /** 탭 안에 보이는 내용 */
  body: ReactNode;
  /** '크게 보기'에서 보이는 내용 (없으면 body를 넓게) */
  big?: ReactNode;
}

/**
 * 혼잡 예측 그래프를 한곳에 모으고 탭으로 고른다 (사용자 QA 10/22: 일·주·월 그래프를 한곳에, '어떻게 판단하나요'도 탭으로, 더보기로 크게).
 * 탭은 키보드 ←→로도 옮겨 다닌다 (WAI-ARIA tabs)
 */
/** Plus 전용 탭 (경수님 QA #2 2단계 10/27: 무료·유료 기능 분리). 한 달은 무료, 1년 혼잡 달력은 Plus */
const PLUS_ONLY = new Set(["year"]);

/** 잠긴 탭: 내용은 흐리게 깔고 가운데에 자물쇠 카드 */
function Locked({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none blur-[6px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xs rounded-3xl bg-white/95 p-5 text-center shadow-[0_8px_30px_rgba(15,23,42,0.18)]">
          <span aria-hidden className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-xl">
            🔒
          </span>
          <p className="mt-2 font-extrabold text-gray-900">{t("1년 혼잡 달력은 Plus 전용이에요")}</p>
          <p className="mt-1 text-xs text-gray-600">{t("1년 중 가장 한산한 날을 한눈에 보고 여행 날짜를 고르세요")}</p>
          <Link href="/pricing" className="mt-4 block rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 py-2.5 text-sm font-extrabold text-white">
            {t("Plus로 보기")} · {t("1개월 {n}원", { n: PLUS.priceKrw.toLocaleString() })}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ForecastTabs({ title, tabs }: { title: string; tabs: ForecastTab[] }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(0);
  const [big, setBig] = useState(false);
  const cur = tabs[sel];
  // 한 달·1년 탭에서 Plus 안내 한 줄 (QA #2: 유료가 안 보인다 — 잠그진 않고 날짜 알림 혜택만 짚는다)
  const plus = usePlus();
  const upsell = !plus && cur?.id === "month";
  const locked = (id: string) => !plus && PLUS_ONLY.has(id);
  const chip = <span className="ml-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-500 px-1.5 py-px text-[11px] font-extrabold text-white">Plus</span>;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        <button
          onClick={() => setBig(true)}
          className="shrink-0 rounded-full bg-gray-900 px-3.5 py-1.5 text-sm font-bold text-white transition active:scale-95"
        >
          {t("더 보기")} ›
        </button>
      </div>
      <div
        role="tablist"
        aria-label={title}
        className="no-scrollbar mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const n = (sel + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          setSel(n);
          (e.currentTarget.children[n] as HTMLElement | undefined)?.focus();
        }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            id={`ft-${tab.id}`}
            aria-selected={i === sel}
            aria-controls={`fp-${tab.id}`}
            tabIndex={i === sel ? 0 : -1}
            onClick={() => setSel(i)}
            className={`min-w-fit flex-1 rounded-xl px-3 py-2 text-[15px] font-bold whitespace-nowrap transition ${
              i === sel ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
            {PLUS_ONLY.has(tab.id) && chip}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.id} role="tabpanel" id={`fp-${tab.id}`} aria-labelledby={`ft-${tab.id}`} hidden={i !== sel} className="mt-4">
          {locked(tab.id) ? <Locked>{tab.body}</Locked> : tab.body}
        </div>
      ))}
      {upsell && (
        <Link href="/pricing" className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
          <span aria-hidden>✨</span>
          <span className="min-w-0 flex-1">{t("Plus면 고른 날짜가 한산해질 때 알림을 받고, 광고 없이 봐요")}</span>
          <span className="shrink-0 text-indigo-600">{t("1개월 {n}원", { n: PLUS.priceKrw.toLocaleString() })} ›</span>
        </Link>
      )}

      <Sheet open={big} onOpenChange={setBig}>
        <SheetContent className="max-h-[92vh] overflow-y-auto md:max-w-4xl">
          <SheetTitle>
            {title} · {cur.label}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("더 보기")}</SheetDescription>
          <div className="no-scrollbar mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setSel(i)}
                aria-pressed={i === sel}
                className={`min-w-fit flex-1 rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap ${
                  i === sel ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                {tab.label}
                {PLUS_ONLY.has(tab.id) && chip}
              </button>
            ))}
          </div>
          <div className="mt-4">{locked(cur.id) ? <Locked>{cur.big ?? cur.body}</Locked> : (cur.big ?? cur.body)}</div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
