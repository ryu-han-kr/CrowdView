import { crowdPose, type CharacterName } from "@/lib/characters";
import { Character } from "@/components/Character";

/**
 * 혼잡도 캐릭터 (사용자 10/24: 직접 준 캐릭터 그림으로 교체, 이전엔 SVG 햄스터 '햄이').
 * 계기판 대신 표정·말풍선으로 단계를 보여 준다. 화면 주제마다 캐릭터가 다르다 (lib/characters)
 * 1 쾌적: 한산 · 2 원활: 기본 웃음 · 3 보통 · 4 혼잡: 땀 · 5 매우 혼잡: 울음 · closed: 조는 모습 (운영 시간 아님)
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
  return (
    <Character
      name={character}
      pose={crowdPose(score, closed)}
      size={size}
      label={label}
      priority
      className={`mascot-bob ${className}`}
    />
  );
}
