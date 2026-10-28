"use client";

import { useEffect, useState } from "react";
import type { Scene } from "@/lib/season-fx";

// 풍경 하나의 폭 1440 × 높이 260 (화면 폭에 맞춰 늘고, 아래는 흐려진다). 색은 옅게 — 위 글자가 잘 읽히게
const W = 1440;
const H = 260;

/** 둥근 나무: 줄기 + 동그란 잎 덩어리 셋 */
function Tree({ x, y, s = 1, leaf, leaf2, trunk = "#a16207" }: { x: number; y: number; s?: number; leaf: string; leaf2: string; trunk?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-5} y={-38} width={10} height={40} rx={4} fill={trunk} />
      <circle cx={-16} cy={-48} r={22} fill={leaf2} />
      <circle cx={16} cy={-50} r={24} fill={leaf2} />
      <circle cx={0} cy={-66} r={28} fill={leaf} />
    </g>
  );
}

function Autumn() {
  const trees = [
    [90, 205, 1.1],
    [210, 215, 0.8],
    [1180, 210, 1.05],
    [1300, 200, 1.25],
    [1395, 220, 0.75],
    [620, 228, 0.6],
  ] as const;
  const leaves = [
    ["#f97316", "#fb923c"],
    ["#dc2626", "#f87171"],
    ["#f59e0b", "#fbbf24"],
  ];
  return (
    <>
      <path d={`M0 200 C 240 150 420 210 720 185 S 1200 150 ${W} 190 V ${H} H 0 Z`} fill="#fde7c7" />
      <path d={`M0 232 C 300 205 600 245 900 222 S 1300 215 ${W} 230 V ${H} H 0 Z`} fill="#fbd5a5" />
      {trees.map(([x, y, s], i) => (
        <Tree key={x} x={x} y={y} s={s} leaf={leaves[i % 3][0]} leaf2={leaves[i % 3][1]} />
      ))}
      {/* 벤치 */}
      <g transform="translate(1040 222)" fill="#92400e">
        <rect x={0} y={-14} width={56} height={6} rx={2} />
        <rect x={0} y={-24} width={56} height={5} rx={2} />
        <rect x={6} y={-8} width={4} height={10} />
        <rect x={46} y={-8} width={4} height={10} />
      </g>
    </>
  );
}

function Winter() {
  const houses = [
    [150, 214, "#fca5a5"],
    [250, 222, "#bfdbfe"],
    [1160, 216, "#fde68a"],
    [1265, 210, "#c4b5fd"],
  ] as const;
  return (
    <>
      <path d={`M0 196 C 260 160 470 210 760 186 S 1220 160 ${W} 196 V ${H} H 0 Z`} fill="#e0ecff" />
      {/* 눈 덮인 소나무 */}
      {[60, 340, 1080, 1370].map((x, i) => (
        <g key={x} transform={`translate(${x} ${222 - (i % 2) * 6})`}>
          <polygon points="0,-90 -30,-20 30,-20" fill="#86b7a5" />
          <polygon points="0,-90 -14,-58 14,-58" fill="#ffffff" />
          <rect x={-4} y={-20} width={8} height={14} fill="#a16207" />
        </g>
      ))}
      {/* 눈 지붕 집 */}
      {houses.map(([x, y, c]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <rect x={-26} y={-34} width={52} height={34} rx={3} fill={c} />
          <polygon points="-34,-32 0,-60 34,-32" fill="#ffffff" />
          <rect x={-7} y={-18} width={14} height={18} rx={2} fill="#78350f" opacity={0.5} />
          <rect x={10} y={-28} width={9} height={8} rx={1} fill="#fef3c7" />
        </g>
      ))}
      <path d={`M0 230 C 320 210 640 245 960 226 S 1300 220 ${W} 232 V ${H} H 0 Z`} fill="#f5f9ff" />
      {/* 눈사람 */}
      <g transform="translate(1000 226)">
        <circle cx={0} cy={-18} r={20} fill="#ffffff" stroke="#dbe4f0" />
        <circle cx={0} cy={-50} r={14} fill="#ffffff" stroke="#dbe4f0" />
        <circle cx={-5} cy={-53} r={1.8} fill="#334155" />
        <circle cx={5} cy={-53} r={1.8} fill="#334155" />
        <polygon points="0,-49 12,-47 0,-45" fill="#f97316" />
        <path d="M-12 -38 Q 0 -32 12 -38" stroke="#ef4444" strokeWidth={5} fill="none" strokeLinecap="round" />
      </g>
    </>
  );
}

function Summer() {
  return (
    <>
      {/* 바다 수평선 + 물결 */}
      <rect x={0} y={170} width={W} height={50} fill="#bae6fd" />
      {[0, 1, 2].map((r) => (
        <path
          key={r}
          d={Array.from({ length: 30 }, (_, i) => `${i === 0 ? "M" : "Q"} ${i * 50 + 25} ${180 + r * 13 - 4} ${i * 50 + 50} ${180 + r * 13}`).join(" ")}
          stroke="#ffffff"
          strokeOpacity={0.7}
          strokeWidth={2}
          fill="none"
        />
      ))}
      {/* 모래사장 */}
      <path d={`M0 212 C 300 200 640 226 980 210 S 1300 204 ${W} 214 V ${H} H 0 Z`} fill="#fde9b8" />
      {/* 파라솔 둘 */}
      {[
        [170, "#f43f5e"],
        [1240, "#0ea5e9"],
      ].map(([x, c]) => (
        <g key={x as number} transform={`translate(${x} 236)`}>
          <rect x={-2} y={-58} width={4} height={60} fill="#78716c" />
          <path d="M-46 -54 Q 0 -96 46 -54 Z" fill={c as string} />
          <path d="M-46 -54 Q -23 -66 0 -54 Q 23 -66 46 -54" fill="#ffffff" opacity={0.6} />
        </g>
      ))}
      {/* 비치볼·튜브 */}
      <circle cx={300} cy={236} r={11} fill="#fde047" stroke="#f97316" strokeWidth={3} />
      <ellipse cx={1120} cy={238} rx={22} ry={9} fill="none" stroke="#fb7185" strokeWidth={7} />
      {/* 야자수 */}
      <g transform="translate(1370 232)">
        <path d="M0 0 Q -6 -50 6 -96" stroke="#a16207" strokeWidth={8} fill="none" strokeLinecap="round" />
        {[-60, -20, 20, 60, 100].map((a) => (
          <ellipse key={a} cx={6} cy={-96} rx={34} ry={8} fill="#4ade80" transform={`rotate(${a} 6 -96) translate(26 0)`} />
        ))}
      </g>
    </>
  );
}

function Spring() {
  return (
    <>
      <path d={`M0 198 C 260 168 480 214 760 190 S 1210 166 ${W} 198 V ${H} H 0 Z`} fill="#dcfce7" />
      <path d={`M0 228 C 320 210 640 244 960 224 S 1300 218 ${W} 230 V ${H} H 0 Z`} fill="#bbf7d0" />
      {/* 벚나무 */}
      <Tree x={1230} y={226} s={1.3} leaf="#fbcfe8" leaf2="#f9a8d4" trunk="#92400e" />
      <Tree x={120} y={214} s={1.05} leaf="#fbcfe8" leaf2="#f9a8d4" trunk="#92400e" />
      <Tree x={1390} y={222} s={0.8} leaf="#bbf7d0" leaf2="#86efac" />
      {/* 나무 아래 책 읽는 사람 */}
      <g transform="translate(1290 226)">
        <circle cx={0} cy={-36} r={8} fill="#fcd9b6" />
        <path d="M-8 -40 Q 0 -50 8 -40" fill="#3f3f46" />
        <rect x={-8} y={-28} width={16} height={20} rx={6} fill="#6366f1" />
        <rect x={-6} y={-10} width={26} height={7} rx={3} fill="#334155" />
        <rect x={6} y={-30} width={14} height={11} rx={1.5} fill="#fef3c7" stroke="#f59e0b" strokeWidth={1.2} transform="rotate(-12 6 -30)" />
      </g>
      {/* 풀밭의 꽃 */}
      {[60, 240, 330, 520, 880, 1010, 1100, 1170].map((x, i) => (
        <g key={x} transform={`translate(${x} ${238 - (i % 3) * 4})`}>
          <rect x={-1} y={-10} width={2} height={10} fill="#22c55e" />
          <circle cx={0} cy={-12} r={4} fill={["#f472b6", "#facc15", "#ffffff"][i % 3]} />
        </g>
      ))}
    </>
  );
}

const Art = ({ scene }: { scene: Scene }) =>
  scene === "autumn" ? <Autumn /> : scene === "winter" ? <Winter /> : scene === "summer" ? <Summer /> : <Spring />;

/**
 * 홈 위쪽 배경 풍경 (경수님 10/28: 가을 단풍나무·겨울 눈마을과 눈사람·여름 해수욕장·봄 들판과 책 읽는 사람).
 * 떨어지는 효과(SeasonBackdrop) 뒤, 사진·카드 뒤에 깐다. 휴대폰은 양 끝 그림만 살짝 보이게 가운데를 기준으로 자른다
 */
export function SeasonScene({ scene: given }: { scene: Scene }) {
  // 미리 보기: 주소 뒤 ?scene=winter 처럼
  const [scene, setScene] = useState(given);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("scene");
    if (q === "autumn" || q === "winter" || q === "summer" || q === "spring") setScene(q);
  }, []);
  return (
    <div
      aria-hidden
      // 땅 줄이 제목 줄 뒤(배너 바로 위)에 오게: 휴대폰은 머리(로고·검색·제목)까지, PC는 제목까지의 높이
      className="pointer-events-none absolute top-0 left-1/2 -z-20 h-[300px] w-screen -translate-x-1/2 overflow-hidden opacity-50 md:h-[215px] md:opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_45%)]"
    >
      {/* 휴대폰: 나무·집이 모인 오른쪽 끝만 크게 */}
      <svg viewBox={`1000 0 440 ${H}`} preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 h-full w-full md:hidden">
        <Art scene={scene} />
      </svg>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 hidden h-full w-full md:block">
        <Art scene={scene} />
      </svg>
    </div>
  );
}
