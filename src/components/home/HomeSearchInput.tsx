"use client";

// 휴대폰 홈 머리의 검색창 (10/27 홈 2차: 검색창을 하나로). 목록(HomeList)과 같은 검색어(useUrlQuery)를 쓴다 →
// 여기에 치면 추천 구역이 접히고 바로 아래 목록이 검색 결과로 바뀐다. Enter 는 목록 위치로 내려간다
import { useI18n } from "@/i18n/client";
import { Glyph } from "@/components/Glyph";
import { useUrlQuery } from "@/components/useUrlQuery";

export function HomeSearchInput({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [q, setQ] = useUrlQuery();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        document.getElementById("places")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-indigo-500 bg-white px-4 py-2 ${className}`}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("장소·지역 검색")}
        aria-label={t("장소·지역 검색")}
        enterKeyHint="search"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {q ? (
        <button type="button" onClick={() => setQ("")} aria-label={t("검색어 지우기")} className="shrink-0 text-gray-500">
          <Glyph e="✕" className="h-4 w-4" />
        </button>
      ) : (
        <Glyph e="🔍" className="h-5 w-5 shrink-0 text-indigo-600" />
      )}
    </form>
  );
}
