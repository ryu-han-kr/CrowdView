import { levelOf } from "@/lib/levels";

/**
 * 혼잡도 캐릭터 햄스터 '햄이' (사용자 10/22: 메인 캐릭터는 햄스터). 계기판 대신 표정·동작으로 단계를 보여 주고,
 * 목에 두른 스카프 색이 단계 색이다.
 * 1 쾌적: 눈 감고 기지개 + 반짝 · 2 원활: 손 흔들기 · 3 보통: 해바라기씨 들고 무표정 · 4 혼잡: 땀, 양옆 햄스터에 끼임
 * 5 매우 혼잡: 어질어질, 사방이 햄스터 · closed: 잠자는 햄이 (운영 시간 아님). 서버·클라이언트 어디서나 쓰는 순수 SVG
 */
export function CrowdMascot({
  score,
  closed = false,
  size = 112,
  className = "",
  label,
}: {
  score: number;
  closed?: boolean;
  size?: number;
  className?: string;
  /** 스크린리더용 설명 (없으면 장식으로 숨김) */
  label?: string;
}) {
  const lv = levelOf(score);
  const k = closed ? 0 : lv.key;
  const scarf = closed ? "#94a3b8" : lv.color;
  const squeeze = k === 4 ? 0.9 : k === 5 ? 0.84 : 1;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* 바닥 그림자 */}
      <ellipse cx="60" cy="112" rx={k === 5 ? 34 : 28} ry="4" fill="#0f172a" opacity="0.12" />

      {/* 혼잡·매우 혼잡: 주변 햄스터(회색) */}
      {k >= 4 && (
        <g>
          <Buddy x={k === 5 ? 13 : 16} y={70} s={0.5} />
          <Buddy x={k === 5 ? 107 : 104} y={70} s={0.5} flip />
          {k === 5 && (
            <>
              <Buddy x={26} y={30} s={0.38} />
              <Buddy x={94} y={30} s={0.38} flip />
              <Buddy x={8} y={102} s={0.34} />
              <Buddy x={112} y={102} s={0.34} flip />
            </>
          )}
        </g>
      )}

      <g transform={squeeze !== 1 ? `translate(60 0) scale(${squeeze} 1) translate(-60 0)` : undefined}>
        {k === 0 ? <Sleeping scarf={scarf} /> : <Hamster k={k} scarf={scarf} />}
      </g>

      {/* 장식 */}
      {k === 1 && (
        <g fill="#fbbf24">
          <Sparkle x={16} y={22} r={6} />
          <Sparkle x={104} y={18} r={4.5} />
          <Sparkle x={108} y={42} r={3.5} />
        </g>
      )}
      {k === 2 && (
        <g stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M104 40q4-4 2-9M108 48q6-3 6-9" />
        </g>
      )}
      {k === 4 && <path d="M88 26c3 5 4 8 4 10a4 4 0 0 1-8 0c0-2 1-5 4-10z" fill="#38bdf8" />}
      {k === 5 && (
        <g stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
          <path d="M44 6l4 6M60 2v7M76 6l-4 6" />
        </g>
      )}
      {k === 0 && (
        <g fill="#64748b" fontFamily="Pretendard, sans-serif" fontWeight="800">
          <text x="84" y="40" fontSize="14">
            Z
          </text>
          <text x="97" y="28" fontSize="10">
            z
          </text>
        </g>
      )}
    </svg>
  );
}

const FUR = "#f0a35e";
const FUR_DARK = "#d9823b";
const CREAM = "#fff3e2";
const PINK = "#f7a1b2";
const INK = "#1f2937";

function Hamster({ k, scarf }: { k: number; scarf: string }) {
  return (
    <g>
      {/* 귀 */}
      <circle cx="37" cy="30" r="10" fill={FUR} />
      <circle cx="83" cy="30" r="10" fill={FUR} />
      <circle cx="37" cy="31" r="5.5" fill={PINK} />
      <circle cx="83" cy="31" r="5.5" fill={PINK} />
      {/* 몸 + 머리 (햄스터는 한 덩어리) */}
      <ellipse cx="60" cy="78" rx="35" ry="30" fill={FUR} />
      <circle cx="60" cy="50" r="29" fill={FUR} />
      <path d="M44 30q16-8 32 0" stroke={FUR_DARK} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
      {/* 배 · 주둥이 */}
      <ellipse cx="60" cy="86" rx="23" ry="19" fill={CREAM} />
      <ellipse cx="60" cy="60" rx="19" ry="13" fill={CREAM} />
      {/* 볼 주머니 */}
      <ellipse cx="38" cy="60" rx="8" ry="7" fill={CREAM} />
      <ellipse cx="82" cy="60" rx="8" ry="7" fill={CREAM} />
      <ellipse cx="40" cy="61" rx="4.5" ry="3" fill={PINK} opacity={k >= 4 ? 0.35 : 0.8} />
      <ellipse cx="80" cy="61" rx="4.5" ry="3" fill={PINK} opacity={k >= 4 ? 0.35 : 0.8} />
      {/* 스카프 (단계 색) */}
      <path d="M33 70q27 12 54 0l-2 8q-25 10-50 0z" fill={scarf} />
      <path d="M74 75l8 14-8-2-3 6-4-16z" fill={scarf} />
      {/* 뒷발 */}
      <ellipse cx="45" cy="106" rx="8" ry="4.5" fill="#f6c79c" />
      <ellipse cx="75" cy="106" rx="8" ry="4.5" fill="#f6c79c" />
      <Face k={k} />
      <Paws k={k} />
    </g>
  );
}

function Face({ k }: { k: number }) {
  const nose = <ellipse cx="60" cy="56.5" rx="3" ry="2.2" fill="#f472b6" />;
  switch (k) {
    case 1: // 쾌적: 웃는 눈 + 활짝
      return (
        <g>
          <path d="M44 47q5-6 10 0M66 47q5-6 10 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
          {nose}
          <path d="M53 61q7 8 14 0z" fill={INK} />
          <path d="M56 63.5q4 3 8 0" fill="#fb7185" />
        </g>
      );
    case 2: // 원활: 동그란 눈 + 미소
      return (
        <g>
          <circle cx="49" cy="46" r="4.2" fill={INK} />
          <circle cx="71" cy="46" r="4.2" fill={INK} />
          <circle cx="50.4" cy="44.6" r="1.4" fill="#fff" />
          <circle cx="72.4" cy="44.6" r="1.4" fill="#fff" />
          {nose}
          <path d="M54 61q3 3 6 0q3 3 6 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </g>
      );
    case 3: // 보통: 점 눈 + 일자 입
      return (
        <g>
          <circle cx="49" cy="47" r="3.6" fill={INK} />
          <circle cx="71" cy="47" r="3.6" fill={INK} />
          {nose}
          <path d="M55 62h10" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case 4: // 혼잡: 걱정 눈썹 + 물결 입
      return (
        <g>
          <path d="M43 40l8-3M77 40l-8-3" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <circle cx="49" cy="47" r="3.2" fill={INK} />
          <circle cx="71" cy="47" r="3.2" fill={INK} />
          {nose}
          <path d="M52 63q2-3 4 0t4 0 4 0 4 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </g>
      );
    default: // 매우 혼잡: 어질어질 눈 + 벌린 입
      return (
        <g>
          <path d="M44 42l9 9M53 42l-9 9M67 42l9 9M76 42l-9 9" stroke={INK} strokeWidth="2.8" strokeLinecap="round" fill="none" />
          {nose}
          <ellipse cx="60" cy="64" rx="5" ry="4.5" fill={INK} />
        </g>
      );
  }
}

/** 앞발: 단계마다 동작 */
function Paws({ k }: { k: number }) {
  const paw = (x: number, y: number) => <ellipse cx={x} cy={y} rx="6" ry="5" fill="#f6c79c" stroke={FUR_DARK} strokeWidth="1.2" />;
  switch (k) {
    case 1: // 기지개
      return (
        <g>
          <path d="M30 60L18 38M90 60l12-22" stroke={FUR} strokeWidth="9" strokeLinecap="round" />
          {paw(17, 35)}
          {paw(103, 35)}
        </g>
      );
    case 2: // 손 흔들기
      return (
        <g>
          {paw(50, 84)}
          <path d="M88 66l10-18" stroke={FUR} strokeWidth="9" strokeLinecap="round" />
          {paw(99, 45)}
        </g>
      );
    case 3: // 해바라기씨 들고
      return (
        <g>
          <path d="M60 74c-4 0-6 6-6 10s2 6 6 6 6-2 6-6-2-10-6-10z" fill="#475569" />
          <path d="M60 76v12" stroke="#e2e8f0" strokeWidth="1.6" />
          {paw(52, 84)}
          {paw(68, 84)}
        </g>
      );
    case 4: // 몸에 붙임 (끼임)
      return (
        <g>
          {paw(40, 82)}
          {paw(80, 82)}
        </g>
      );
    default: // 허우적
      return (
        <g>
          <path d="M30 66L16 58M90 66l14-8" stroke={FUR} strokeWidth="9" strokeLinecap="round" />
          {paw(15, 57)}
          {paw(105, 57)}
        </g>
      );
  }
}

/** 잠자는 햄이: 동그랗게 말고 눈 감음 */
function Sleeping({ scarf }: { scarf: string }) {
  return (
    <g>
      <circle cx="42" cy="58" r="8" fill={FUR} />
      <circle cx="42" cy="59" r="4.5" fill={PINK} />
      <ellipse cx="60" cy="84" rx="40" ry="25" fill={FUR} />
      <ellipse cx="50" cy="82" rx="22" ry="16" fill={CREAM} />
      <path d="M40 80q4 3 8 0M54 80q4 3 8 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <ellipse cx="51" cy="87" rx="2.6" ry="2" fill="#f472b6" />
      <path d="M78 66q14 4 16 20" stroke={scarf} strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** 주변 햄스터 (회색 실루엣) */
function Buddy({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) translate(-60 -70)`} fill="#cbd5e1">
      <circle cx="40" cy="34" r="10" />
      <circle cx="80" cy="34" r="10" />
      <ellipse cx="60" cy="78" rx="34" ry="28" />
      <circle cx="60" cy="52" r="27" />
      <circle cx="50" cy="50" r="3.5" fill="#94a3b8" />
      <circle cx="70" cy="50" r="3.5" fill="#94a3b8" />
    </g>
  );
}

function Sparkle({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <path
      d={`M${x} ${y - r}q${r * 0.25} ${r * 0.75} ${r} ${r}q-${r * 0.75} ${r * 0.25}-${r} ${r}q-${r * 0.25}-${r * 0.75}-${r}-${r}q${r * 0.75}-${r * 0.25} ${r}-${r}z`}
    />
  );
}
