import { levelOf } from "@/lib/levels";

/**
 * 혼잡도 캐릭터 '핀이' (지도 핀 모양). 계기판 대신 표정·동작으로 단계를 보여 준다 (사용자 QA 10/22).
 * 1 쾌적: 눈 감고 기지개 + 반짝 · 2 원활: 손 흔들기 · 3 보통: 무표정 · 4 혼잡: 땀, 양옆에서 밀림 · 5 매우 혼잡: 어질어질, 사방이 사람
 * closed: 잠자는 핀이 (운영 시간 아님). 서버·클라이언트 어디서나 쓰는 순수 SVG
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
  const body = closed ? "#9ca3af" : lv.color;
  const id = `pin-${k}`;
  const crowd = "#cbd5e1";
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
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 바닥 그림자 */}
      <ellipse cx="60" cy="110" rx={k === 5 ? 30 : 22} ry="4" fill="#0f172a" opacity="0.12" />

      {/* 혼잡·매우 혼잡: 주변 사람(작은 회색 핀) */}
      {k >= 4 && (
        <g fill={crowd}>
          <Pin x={k === 5 ? 14 : 18} y={52} s={0.55} />
          <Pin x={k === 5 ? 106 : 102} y={52} s={0.55} />
          {k === 5 && (
            <>
              <Pin x={28} y={22} s={0.42} />
              <Pin x={92} y={22} s={0.42} />
              <Pin x={10} y={88} s={0.4} />
              <Pin x={110} y={88} s={0.4} />
            </>
          )}
        </g>
      )}

      {/* 몸 (지도 핀): 둥근 머리 + 아래 꼭지 */}
      <g
        transform={k === 4 ? "translate(60 0) scale(0.9 1) translate(-60 0)" : k === 5 ? "translate(60 0) scale(0.84 1) translate(-60 0)" : undefined}
      >
        <path
          d="M60 14c-21 0-37 15.5-37 35.5 0 25 26.5 47 33.4 55.6a4.6 4.6 0 0 0 7.2 0C70.5 96.5 97 74.5 97 49.5 97 29.5 81 14 60 14z"
          fill={body}
        />
        <path
          d="M60 14c-21 0-37 15.5-37 35.5 0 25 26.5 47 33.4 55.6a4.6 4.6 0 0 0 7.2 0C70.5 96.5 97 74.5 97 49.5 97 29.5 81 14 60 14z"
          fill={`url(#${id}-g)`}
        />
        {/* 얼굴 판 */}
        <ellipse cx="60" cy="50" rx="25" ry="22" fill="#fff" />
        <Face k={k} />
      </g>

      {/* 팔 */}
      <Arms k={k} color={body} />

      {/* 장식 */}
      {k === 1 && (
        <g fill="#fbbf24">
          <Sparkle x={18} y={26} r={6} />
          <Sparkle x={100} y={20} r={4.5} />
          <Sparkle x={104} y={44} r={3.5} />
        </g>
      )}
      {k === 4 && <path d="M85 30c3 5 4 8 4 10a4 4 0 0 1-8 0c0-2 1-5 4-10z" fill="#38bdf8" />}
      {k === 5 && (
        <g stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
          <path d="M44 8l4 6M60 4v7M76 8l-4 6" />
        </g>
      )}
      {k === 0 && (
        <g fill="#64748b" fontFamily="Pretendard, sans-serif" fontWeight="800">
          <text x="86" y="24" fontSize="14">
            Z
          </text>
          <text x="98" y="12" fontSize="10">
            z
          </text>
        </g>
      )}
    </svg>
  );
}

function Face({ k }: { k: number }) {
  const ink = "#1f2937";
  const cheek = "#fda4af";
  switch (k) {
    case 0: // 잠
      return (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M45 50h8M67 50h8" />
          <path d="M56 61q4 2 8 0" />
        </g>
      );
    case 1: // 쾌적: 웃는 눈 + 활짝
      return (
        <g>
          <g stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none">
            <path d="M44 50q5-6 10 0M66 50q5-6 10 0" />
          </g>
          <path d="M50 57q10 11 20 0z" fill={ink} />
          <path d="M54 60.5q6 4 12 0" fill="#fb7185" />
          <ellipse cx="43" cy="58" rx="4.5" ry="3" fill={cheek} opacity="0.8" />
          <ellipse cx="77" cy="58" rx="4.5" ry="3" fill={cheek} opacity="0.8" />
        </g>
      );
    case 2: // 원활: 동그란 눈 + 미소
      return (
        <g>
          <circle cx="50" cy="48" r="4.2" fill={ink} />
          <circle cx="70" cy="48" r="4.2" fill={ink} />
          <circle cx="51.4" cy="46.6" r="1.4" fill="#fff" />
          <circle cx="71.4" cy="46.6" r="1.4" fill="#fff" />
          <path d="M51 58q9 8 18 0" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
          <ellipse cx="43" cy="57" rx="4" ry="2.6" fill={cheek} opacity="0.7" />
          <ellipse cx="77" cy="57" rx="4" ry="2.6" fill={cheek} opacity="0.7" />
        </g>
      );
    case 3: // 보통: 점 눈 + 일자 입
      return (
        <g>
          <circle cx="50" cy="49" r="3.6" fill={ink} />
          <circle cx="70" cy="49" r="3.6" fill={ink} />
          <path d="M53 60h14" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 4: // 혼잡: 걱정 눈썹 + 물결 입
      return (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M43 43l8-4M77 43l-8-4" />
          <circle cx="50" cy="50" r="3.2" fill={ink} stroke="none" />
          <circle cx="70" cy="50" r="3.2" fill={ink} stroke="none" />
          <path d="M50 61q3-3 5 0t5 0 5 0 5 0" />
        </g>
      );
    default: // 매우 혼잡: 어질어질 눈 + 벌린 입
      return (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M45 44l9 9M54 44l-9 9M66 44l9 9M75 44l-9 9" />
          <ellipse cx="60" cy="62" rx="6" ry="5" fill={ink} stroke="none" />
        </g>
      );
  }
}

function Arms({ k, color }: { k: number; color: string }) {
  const p = { stroke: color, strokeWidth: 7, strokeLinecap: "round" as const, fill: "none" };
  switch (k) {
    case 1: // 기지개
      return <path d="M27 54L14 36M93 54l13-18" {...p} />;
    case 2: // 손 흔들기
      return <path d="M27 60l-11 10M93 56l12-14" {...p} />;
    case 4: // 몸에 붙임 (끼임)
      return <path d="M31 58l-3 14M89 58l3 14" {...p} />;
    case 5: // 허우적
      return <path d="M30 52L18 46M90 52l12-6" {...p} />;
    default:
      return <path d="M27 60l-9 12M93 60l9 12" {...p} />;
  }
}

/** 작은 사람 핀 (배경 군중) */
function Pin({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(-60 -60)`}>
      <path d="M60 14c-21 0-37 15.5-37 35.5 0 25 26.5 47 33.4 55.6a4.6 4.6 0 0 0 7.2 0C70.5 96.5 97 74.5 97 49.5 97 29.5 81 14 60 14z" />
      <circle cx="52" cy="48" r="4" fill="#94a3b8" />
      <circle cx="68" cy="48" r="4" fill="#94a3b8" />
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
