import { type CSSProperties } from "react";
import { characterSrc, type CharacterName, type Pose } from "@/lib/characters";
import FX from "@/data/characters-fx.json";

/** 포즈별 움직임 층 (scripts/character-layers.py). f: 땀·반짝임 표시, l: 감은 눈, z: 머리 위 zzz 시작 자리(칸 대비 %) */
const LAYERS = FX as Record<string, { f?: number; l?: number; z?: number[] }>;

/**
 * 캐릭터 한 컷 (300x400 투명 webp, 발끝이 아래에 맞춰져 있다). 서버·클라이언트 어디서나 쓰는 순수 img.
 * 이미지 최적화 서버를 거치지 않게 next/image 대신 img (컷마다 20KB 안팎).
 * 경수님 11/1: 효과는 건드리지 않아도 늘 움직인다 — 몸통 위에 땀·반짝임 층, 눈 깜빡임 층, 자는 포즈의 zzz를 겹친다
 */
export function Character({
  name,
  pose,
  size = 112,
  width,
  className = "",
  label,
  priority = false,
}: {
  name: CharacterName;
  pose: Pose;
  /** 높이(px). 너비는 3/4 */
  size?: number;
  /** 칸 너비(px). 정사각 그림(대기 화면)처럼 3/4가 아닐 때만 */
  width?: number;
  className?: string;
  /** 스크린리더용 설명 (없으면 장식으로 숨김) */
  label?: string;
  /** 첫 화면에 바로 보이는 자리면 true (지연 로드 안 함) */
  priority?: boolean;
}) {
  const w = width ?? Math.round(size * 0.75);
  // 100px 이하 자리는 작은 판(150×200)으로: 300×400 원본은 2배 화면에서도 남는다 (10/26 Lighthouse '사진 크기' 17~22KB 낭비)
  const src = (kind: string) => characterSrc(name, pose).replace(/\.webp$/, `.${kind}${size <= 100 ? ".sm" : ""}.webp`);
  const fx = LAYERS[`${name}/${pose}`];
  const loading = priority ? "eager" : "lazy";
  const layer = (kind: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src(kind)} width={w} height={size} alt="" aria-hidden loading={loading} decoding="async" draggable={false} className={cls} />
  );
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`mascot mascot-stack select-none ${className}`}
      style={{ width: w, height: size } as CSSProperties}
    >
      {layer("body", "mascot-body")}
      {fx?.f && layer("fx", "mascot-fx")}
      {fx?.l && layer("lid", "mascot-lid")}
      {fx?.z && (
        <span aria-hidden className="zzz-wrap" style={{ left: `${fx.z[0]}%`, top: `${fx.z[1]}%`, fontSize: Math.max(13, Math.round(size * 0.15)) }}>
          <span className="zzz">z</span>
          <span className="zzz">z</span>
          <span className="zzz">z</span>
        </span>
      )}
    </span>
  );
}
