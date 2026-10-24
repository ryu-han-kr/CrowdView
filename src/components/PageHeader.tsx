import type { ReactNode } from "react";
import type { CharacterName, Pose } from "@/lib/characters";
import { Character } from "./Character";

/** 탭 화면 머리: 제목·설명 왼쪽, 화면 주제 캐릭터 오른쪽 (발끝을 설명 아랫줄에 맞춤) */
export function PageHeader({
  title,
  name,
  pose = "base",
  className = "",
  children,
}: {
  title: ReactNode;
  name: CharacterName;
  pose?: Pose;
  className?: string;
  /** 제목 아래 설명 */
  children?: ReactNode;
}) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {children}
      </div>
      <Character name={name} pose={pose} size={88} priority className="-mt-4 -mb-1 shrink-0" />
    </div>
  );
}
