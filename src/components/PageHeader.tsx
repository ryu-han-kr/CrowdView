import type { ReactNode } from "react";
import type { CharacterName, Pose } from "@/lib/characters";

/**
 * 탭 화면 머리 (홈·지도·가이드·코스·서울·마이 공통): 화면 색 막대 + 제목 + 설명.
 * 10/27 경수님 QA #4: 화면마다 제목 위치·크기·색이 달랐다 → 한 부품으로 통일. 색은 body[data-page]의 --page-accent.
 * QA #5: 캐릭터는 장소 상세 포토카드·대기 화면에서만 → 여기선 안 그린다 (name·pose는 호환용으로 받기만)
 */
export function PageHeader({
  title,
  className = "",
  children,
  heading = true,
}: {
  title: ReactNode;
  name?: CharacterName;
  pose?: Pose;
  size?: number;
  className?: string;
  /** 제목 아래 설명 */
  children?: ReactNode;
  /** false면 제목을 h1이 아닌 글자로 (홈은 숨은 h1이 따로 있어 h1이 둘이었다 — 총점검 10/30) */
  heading?: boolean;
}) {
  return (
    <div className={`page-head ${className}`}>
      <span aria-hidden className="page-head-bar" />
      {heading ? <h1 className="page-title">{title}</h1> : <p className="page-title">{title}</p>}
      {children}
    </div>
  );
}
