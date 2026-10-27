import type { ReactNode } from "react";
import type { CharacterName, Pose } from "@/lib/characters";
import { Glyph } from "@/components/Glyph";

/** 비어 있는 목록·찾는 결과 없음 안내: 점선 상자(empty-note) 안에 아이콘 + 문구 (캐릭터는 상세·대기 화면에서만, QA #5 10/27) */
export function EmptyState({
  pose = "explore",
  className = "",
  children,
}: {
  name?: CharacterName;
  pose?: Pose;
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  const icon = pose === "wait" ? "⏳" : pose === "packed" ? "🧳" : pose === "alert" ? "🔔" : "🔍";
  return (
    <div className={`empty-note flex flex-col items-center gap-2 px-5 pt-5 pb-5 text-center ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <Glyph e={icon} className="h-5 w-5" />
      </span>
      <div>{children}</div>
    </div>
  );
}
