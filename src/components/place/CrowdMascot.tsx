import { crowdPose, poseMotionClass, type CharacterName } from "@/lib/characters";
import { Character } from "@/components/Character";
import { levelOf } from "@/lib/levels";

/**
 * 혼잡도 캐릭터 (사용자 10/24: 직접 준 캐릭터 그림으로 교체, 이전엔 SVG 햄스터 '햄이').
 * 계기판 대신 표정·말풍선으로 단계를 보여 준다. 화면 주제마다 캐릭터가 다르다 (lib/characters)
 * 1 쾌적: 한산 · 2 원활: 기본 웃음 · 3 보통 · 4 혼잡: 땀 · 5 매우 혼잡: 울음 · closed: 조는 모습 (운영 시간 아님)
 * 사용자 10/26: 쾌적·보통 그림 차이가 약해서 발밑에 단계 색 기운 + 단계마다 다른 움직임을 더한다
 */
export function CrowdMascot({
  score,
  closed = false,
  size = 112,
  className = "",
  label,
  character = "hamster",
}: {
  score: number;
  closed?: boolean;
  size?: number;
  className?: string;
  /** 스크린리더용 설명 (없으면 장식으로 숨김) */
  label?: string;
  character?: CharacterName;
}) {
  const pose = crowdPose(score, closed);
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: Math.round(size * 0.75), height: size }}>
      <span aria-hidden className="mascot-aura" style={{ background: closed ? "#9ca3af" : levelOf(score).color }} />
      <Character name={character} pose={pose} size={size} label={label} priority className={`relative ${poseMotionClass(pose)}`} />
    </span>
  );
}
