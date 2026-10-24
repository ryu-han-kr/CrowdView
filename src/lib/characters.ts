import { levelOf } from "@/lib/levels";
import type { Category } from "@/lib/types";

/**
 * 캐릭터 5종 (사용자 10/24: photo/charactor 시트 → scripts/cut-characters.py 로 잘라 public/characters/<캐릭터>/<포즈>.webp).
 * 화면 주제마다 다른 캐릭터: 햄스터 = 기본(장소·명소, 메인 캐릭터 10/22), 수달 = 서울 실시간(한강 수달),
 * 여우 = 여행 가이드, 토끼 = 축제, 너구리 = 공항·길찾기
 */
export type CharacterName = "hamster" | "otter" | "fox" | "rabbit" | "raccoon";
export type Pose = "base" | "calm" | "normal" | "busy" | "packed" | "explore" | "pick" | "wait" | "alert" | "done";

/** 혼잡도 단계 → 포즈 (1 쾌적 = 한산, 2 원활 = 기본 웃음, 3~5 = 보통·혼잡·매우 혼잡, 운영 시간 아님 = 조는 모습) */
export function crowdPose(score: number, closed = false): Pose {
  if (closed) return "wait";
  return (["calm", "base", "normal", "busy", "packed"] as const)[levelOf(score).key - 1];
}

export function characterSrc(name: CharacterName, pose: Pose) {
  return `/characters/${name}/${pose}.webp`;
}

/** 장소 분류 → 캐릭터 (명소는 여행 가이드의 여우, 물가는 수달, 행사는 축제의 토끼, 공항은 너구리) */
const BY_CATEGORY: Partial<Record<Category, CharacterName>> = {
  landmark: "fox",
  waterpark: "otter",
  beach: "otter",
  event: "rabbit",
  airport: "raccoon",
};
export function categoryCharacter(category: Category): CharacterName {
  return BY_CATEGORY[category] ?? "hamster";
}
