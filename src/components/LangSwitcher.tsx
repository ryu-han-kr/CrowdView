"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LANGS, LANG_LABEL, localePath, stripLang } from "@/i18n/config";
import { Glyph } from "@/components/Glyph";

/** 🌐 언어 선택. 같은 페이지의 다른 언어 주소로 이동한다 */
export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const go = (l: (typeof LANGS)[number]) => {
    const { path } = stripLang(pathname);
    document.cookie = `cv-lang=${l}; path=/; max-age=31536000; samesite=lax`;
    window.location.assign(localePath(l, path) + window.location.search);
  };

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // 읽어 주는 이름 = 보이는 언어 이름 + '언어 선택' (보이는 글자가 이름에 들어가야 음성 명령으로도 누를 수 있다)
        aria-label={`${LANG_LABEL[lang]} · ${t("언어 선택")}`}
        className={`flex items-center gap-1.5 rounded-full border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 ${
          compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
        </svg>
        {/* PC 상단 메뉴: 태블릿 폭에서는 지구본만 (메뉴 '마이'가 밀려 가려지던 것) */}
        <span className={compact ? undefined : "hidden xl:inline"}>{LANG_LABEL[lang]}</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-50 mt-1.5 w-36 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-xl">
          {LANGS.map((l) => (
            <li key={l}>
              <button
                role="option"
                aria-selected={l === lang}
                onClick={() => go(l)}
                className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-gray-50 ${
                  l === lang ? "font-semibold text-indigo-600" : "text-gray-700"
                }`}
              >
                {LANG_LABEL[l]}
                {l === lang && <Glyph e="✓" className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
