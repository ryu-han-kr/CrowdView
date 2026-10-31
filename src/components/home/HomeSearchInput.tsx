"use client";

// 휴대폰 홈 머리의 검색창 (10/27 홈 2차: 검색창을 하나로). 10/31부터 치는 동안 바로 아래로 결과판이 뜬다(시안 ②, SearchBox) →
// Enter·'전체 결과 보기'를 누르면 홈 목록(HomeList)이 같은 검색어(useUrlQuery)로 바뀌고 목록 위치로 내려간다
import { SearchBox } from "@/components/search/SearchBox";

export function HomeSearchInput({ className = "" }: { className?: string }) {
  return <SearchBox variant="mobile" className={className} />;
}
