"use client";

import { useEffect, useState } from "react";
import { StickyBar } from "./StickyBar";

// 이모지 칩 탭 + 내용 (홈 파트 칩과 같은 모양). 공항 상세의 파트 선택에 쓴다
export interface ChipTab {
  id: string;
  label: string;
  emoji: string;
  content: React.ReactNode;
}

/** 탭 + 내용. 내용은 서버에서 그린 것을 그대로 받아 고른 탭만 보여준다. 주소의 ?tab= 으로 바로 연다 */
export function ChipTabPanels({ tabs }: { tabs: ChipTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  // 예: 공항 목록의 '주차장' 버튼 → ?tab=parking
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && tabs.some((x) => x.id === t)) setActive(t);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const choose = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  };
  return (
    <div>
      <StickyBar className="-mx-5 px-5 md:mx-0 md:px-0">
        <div role="tablist" className="no-scrollbar flex gap-2 overflow-x-auto py-3">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => choose(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 md:hover:border-gray-400"
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </StickyBar>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== active} className="pt-3">
          {t.content}
        </div>
      ))}
    </div>
  );
}
