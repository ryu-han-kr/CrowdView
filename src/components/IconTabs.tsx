"use client";

import { useState } from "react";

// 아이콘 + 글자 + 밑줄 탭. 홈의 카테고리, 공항 상세의 파트 선택에 함께 쓴다
export interface IconTab {
  id: string;
  label: string;
  /** 24x24 stroke 아이콘 path */
  icon: string;
}

export function IconTabBar({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: IconTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={`no-scrollbar flex overflow-x-auto border-b border-gray-100 ${className}`}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`flex min-w-[64px] flex-1 shrink-0 flex-col items-center gap-1 border-b-2 px-2 pt-1 pb-2 text-xs font-semibold transition-colors ${
              on ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={on ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** 탭 + 내용. 내용은 서버에서 그린 것을 그대로 받아 고른 탭만 보여준다 */
export function IconTabPanels({ tabs }: { tabs: (IconTab & { content: React.ReactNode })[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div className="sticky top-0 z-20 -mx-5 bg-white/95 px-3 pt-2 backdrop-blur md:top-16 md:mx-0 md:px-0">
        <IconTabBar tabs={tabs} active={active} onChange={setActive} />
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== active} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** 자주 쓰는 아이콘 */
export const ICONS = {
  all: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z",
  landmark: "M3 21h18M5 21V10m14 11V10M4 10l8-6 8 6M9 21v-6h6v6",
  street: "M4 21V8l4-3 4 3v13M12 21v-9l4-3 4 3v9M7 11h2m-2 3h2m7 1h2",
  themepark: "M12 3a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8Zm0 8v10m-5 0h10M6.5 11 9 21m8.5-10L15 21",
  beach: "M3 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M12 4v12M12 4c4 0 7 3 7 6H5c0-3 3-6 7-6Z",
  airport: "M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4.5l2 1.5v1.5l-3.5-1-3.5 1V19l2-1.5V13l-7 2v-2l7-4z",
  festival: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  gate: "M4 21V5h16v16M9 21v-6h6v6M8 9h2m4 0h2",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5M12 8v4l3 2",
  parking: "M5 3h14v18H5zM10 16V8h3a2.5 2.5 0 0 1 0 5h-3",
} as const;
