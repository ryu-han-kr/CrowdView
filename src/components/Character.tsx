import { characterSrc, type CharacterName, type Pose } from "@/lib/characters";

/**
 * 캐릭터 그림 한 컷 (300x400 투명 webp, 발끝이 아래에 맞춰져 있다). 서버·클라이언트 어디서나 쓰는 순수 img.
 * 이미지 최적화 서버를 거치지 않게 next/image 대신 img (컷마다 20KB 안팎)
 */
export function Character({
  name,
  pose,
  size = 112,
  className = "",
  label,
  priority = false,
}: {
  name: CharacterName;
  pose: Pose;
  /** 높이(px). 너비는 3/4 */
  size?: number;
  className?: string;
  /** 스크린리더용 설명 (없으면 장식으로 숨김) */
  label?: string;
  /** 첫 화면에 바로 보이는 자리면 true (지연 로드 안 함) */
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={characterSrc(name, pose)}
      width={Math.round(size * 0.75)}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  );
}
