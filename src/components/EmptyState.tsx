import type { ReactNode } from "react";
import type { CharacterName, Pose } from "@/lib/characters";
import { Character } from "./Character";

/** 비어 있는 목록·찾는 결과 없음 안내: 점선 상자(empty-note) 안에 캐릭터 + 문구 */
export function EmptyState({
  name = "hamster",
  pose = "explore",
  size = 96,
  className = "",
  children,
}: {
  name?: CharacterName;
  pose?: Pose;
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`empty-note flex flex-col items-center gap-1 px-5 pt-3 pb-5 text-center ${className}`}>
      <Character name={name} pose={pose} size={size} />
      <div>{children}</div>
    </div>
  );
}
