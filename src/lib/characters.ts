import { levelOf } from "@/lib/levels";
import type { Category } from "@/lib/types";

/**
 * 캐릭터 5종 (사용자 10/24: photo/charactor 시트 → scripts/cut-characters.py 로 잘라 public/characters/<캐릭터>/<포즈>.webp).
 * 화면 주제마다 다른 캐릭터: 햄스터 = 기본(장소·명소, 메인 캐릭터 10/22), 수달 = 서울 실시간(한강 수달),
 * 여우 = 여행 가이드, 토끼 = 축제, 너구리 = 공항·길찾기
 */
export type CharacterName = "hamster" | "otter" | "fox" | "rabbit" | "raccoon";
export type Pose = "base" | "calm" | "normal" | "busy" | "packed" | "explore" | "pick" | "wait" | "alert" | "done";

/**
 * 혼잡도 단계 → 포즈 (1 쾌적 = 기지개, 2 원활 = 지도 들고 나들이, 3 보통 = 손 모으고 두리번, 4 혼잡 = 땀, 5 매우 혼잡 = 깔림, 운영 시간 아님 = 조는 모습)
 * 사용자 10/26: 원활(base)과 보통(normal)이 같은 포즈라 구분이 안 됨 → 원활은 explore 컷으로
 */
export function crowdPose(score: number, closed = false): Pose {
  if (closed) return "wait";
  return (["calm", "explore", "normal", "busy", "packed"] as const)[levelOf(score).key - 1];
}

/** 포즈 → 움직임 클래스 (globals.css). 쾌적·보통·혼잡이 한눈에 다르게: 쾌적 느긋한 흔들, 원활 통통, 보통 두리번, 혼잡 눌리듯, 매우 혼잡 덜덜 (사용자 10/26) */
export function poseMotionClass(pose: Pose): string {
  return ({ calm: "mascot-lv-calm", normal: "mascot-lv-normal", busy: "mascot-lv-busy", packed: "mascot-lv-packed" } as Partial<Record<Pose, string>>)[pose] ?? "mascot-bob";
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

/** 주소 → 그 화면 주제 캐릭터 (대기·오류 화면용). 앞의 언어 코드(/en 등)는 무시 */
export function pathCharacter(pathname: string): CharacterName {
  const p = pathname.replace(/^\/(en|ja|zh-CN|zh-TW|ko)(?=\/|$)/, "");
  if (/^\/(guide|spot)/.test(p)) return "fox";
  if (/^\/seoul/.test(p)) return "otter";
  if (/^\/(festival|events)/.test(p)) return "rabbit";
  if (/^\/(airport|route)/.test(p)) return "raccoon";
  return "hamster";
}
