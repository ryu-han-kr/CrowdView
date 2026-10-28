"use client";

import { useEffect, useRef, useState } from "react";
import type { SeasonFx } from "@/lib/season-fx";
import type { DayFx } from "@/lib/kr-days";

type Fx = SeasonFx | DayFx;

/** 화면 폭 1000px당 알갱이 수 (가볍게, 경수님 10/28 '성능 점수 유지') */
const DENSITY: Record<Fx, number> = { snow: 46, rain: 60, leaves: 20, sprout: 18, sun: 18, confetti: 34, moon: 16 };
const CONFETTI = ["#f43f5e", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#0ea5e9"];
const LEAF = ["#f97316", "#ea580c", "#dc2626", "#f59e0b", "#b45309"];

interface P {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  a: number; // 회전·흔들림 위상
  va: number;
  c: string;
}

/**
 * 홈 위쪽 배경 날씨·계절 효과 (눈·비·낙엽·벚꽃잎·햇살). 화면을 누르는 데 방해되지 않게 pointer-events 없음,
 * 움직임 줄이기 설정이면 안 그린다. 첫 그림이 끝난 뒤(브라우저가 한가할 때) 시작하고, 탭이 안 보이거나 화면 밖이면 멈춘다
 */
export function SeasonBackdrop({ fx: given }: { fx: Fx }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [fx, setFx] = useState(given);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // 미리 보기: 주소 뒤 ?fx=snow 처럼 붙이면 그 효과로 (전후 사진·확인용)
    const forced = new URLSearchParams(location.search).get("fx");
    if (forced && forced in DENSITY) setFx(forced as Fx);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
    const id = idle(() => setOn(true));
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id as number) : clearTimeout(id as number));
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!on || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let ps: P[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const make = (top: boolean): P => {
      const base = { x: rnd(0, w), y: top ? rnd(-h * 0.2, 0) : rnd(0, h), a: rnd(0, Math.PI * 2), va: rnd(0.01, 0.03), vx: 0, c: "" };
      if (fx === "snow") return { ...base, r: rnd(1.4, 3.6), vy: rnd(0.35, 0.9), c: "" };
      if (fx === "rain") return { ...base, r: rnd(9, 16), vy: rnd(7, 10), vx: -1.4 };
      if (fx === "leaves") return { ...base, r: rnd(8, 13), vy: rnd(0.5, 1.1), va: rnd(0.01, 0.025), c: LEAF[Math.floor(rnd(0, LEAF.length))] };
      if (fx === "confetti") return { ...base, r: rnd(4, 7), vy: rnd(0.8, 1.6), va: rnd(0.04, 0.09), c: CONFETTI[Math.floor(rnd(0, CONFETTI.length))] };
      if (fx === "sprout") return { ...base, r: rnd(6, 9), vy: rnd(0.4, 0.8), c: Math.random() < 0.7 ? "#fbcfe8" : "#f9a8d4" };
      return { ...base, y: rnd(0, h), r: rnd(1.5, 3.5), vy: -rnd(0.1, 0.3), c: "" }; // 햇살·달빛 알갱이는 천천히 떠오른다
    };
    // 휴대폰은 맨 위로 올릴 때 주소창이 나타나며 resize가 와서, 그때마다 알갱이를 새로 뿌려 처음부터 다시 시작했다 (경수님 10/28).
    // 크기만 맞추고 알갱이는 그대로 두며, 폭이 바뀐 만큼만 늘리거나 줄인다
    const resize = () => {
      const nw = cv.clientWidth;
      const nh = cv.clientHeight;
      if (nw === w && nh === h) return;
      if (w) for (const p of ps) p.x *= nw / w;
      w = nw;
      h = nh;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(6, Math.round((w / 1000) * DENSITY[fx] * (w < 768 ? 1.3 : 1)));
      while (ps.length < n) ps.push(make(false));
      ps.length = n;
    };
    resize();

    let t0 = performance.now();
    const draw = (now: number) => {
      // 탭을 오래 비웠다 돌아와도 한 번에 튀지 않게 1/60초 단위로 최대 3칸
      const k = Math.min(3, (now - t0) / 16.7);
      t0 = now;
      ctx.clearRect(0, 0, w, h);
      if (fx === "moon") {
        // 한가위 보름달: 오른쪽 위 둥근 달과 은은한 달무리
        // 휴대폰은 제목 글자를 가리지 않게 오른쪽 맨 위 모서리로
        const mx = w < 768 ? w - 36 : w * 0.86;
        const my = w < 768 ? 10 : 90;
        const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 150 + 10 * Math.sin(now / 2000));
        halo.addColorStop(0, "rgba(253, 230, 138, 0.45)");
        halo.addColorStop(1, "rgba(253, 230, 138, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(254, 240, 138, 0.6)";
        ctx.beginPath();
        ctx.arc(mx, my, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      if (fx === "sun") {
        // 오른쪽 위 햇살: 천천히 숨 쉬는 빛 번짐
        const pulse = 0.85 + 0.15 * Math.sin(now / 1800);
        const g = ctx.createRadialGradient(w * 0.88, -20, 0, w * 0.88, -20, Math.max(w, h) * 0.55 * pulse);
        g.addColorStop(0, "rgba(253, 224, 71, 0.38)");
        g.addColorStop(0.45, "rgba(253, 186, 116, 0.12)");
        g.addColorStop(1, "rgba(253, 186, 116, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (const p of ps) {
        p.a += p.va * k;
        p.y += p.vy * k;
        p.x += (p.vx + (fx === "rain" ? 0 : Math.sin(p.a) * (fx === "snow" ? 0.35 : 0.8))) * k;
        const rising = fx === "sun" || fx === "moon";
        if (p.y > h + 20 || p.y < -30 || p.x < -30 || p.x > w + 30) Object.assign(p, make(!rising), rising ? { y: h + 10 } : {});
        ctx.save();
        if (fx === "snow") {
          ctx.fillStyle = "rgba(165, 180, 252, 0.55)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (fx === "rain") {
          ctx.strokeStyle = "rgba(99, 102, 241, 0.28)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.r);
          ctx.stroke();
        } else if (fx === "confetti") {
          // 꽃가루: 납작한 종이 조각이 뒤집히며 떨어진다
          ctx.translate(p.x, p.y);
          ctx.rotate(p.a * 3);
          ctx.scale(Math.cos(p.a * 4), 1);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        } else if (fx === "sun" || fx === "moon") {
          ctx.fillStyle = `rgba(251, 191, 36, ${0.25 + 0.2 * Math.sin(p.a)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 낙엽·벚꽃잎: 끝이 뾰족한 잎 모양을 돌리며 떨어뜨린다
          ctx.translate(p.x, p.y);
          ctx.rotate(p.a * 2);
          ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.a * 1.5)));
          ctx.globalAlpha = fx === "leaves" ? 0.7 : 0.8;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.moveTo(-p.r, 0);
          ctx.quadraticCurveTo(0, -p.r * 0.75, p.r, 0);
          ctx.quadraticCurveTo(0, p.r * 0.75, -p.r, 0);
          ctx.fill();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };

    let raf = 0;
    let visible = true;
    const run = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) {
        t0 = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      run();
    });
    io.observe(cv);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("resize", resize);
    run();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("resize", resize);
    };
  }, [on, fx]);

  if (!on) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden
      data-fx={fx}
      // 홈 위쪽 한 화면 높이만, 아래로 갈수록 흐려지게. 사진·카드 뒤 배경에서 떨어지게 -z (main이 isolate라 main 바탕 위·내용 아래, 경수님 10/28).
      // 높이는 lvh: 주소창이 들어가고 나와도 바뀌지 않게. 폭은 화면 전체: PC는 본문 폭에만 깔면 배너 뒤에 가려 거의 안 보였다 (경수님 10/28)
      className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[min(100lvh,900px)] w-screen -translate-x-1/2 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
    />
  );
}

/** 봄: 머리 아래 줄에 새싹이 자라 올라와 살랑인다 (CSS만). ?fx=sprout 미리 보기에서도 */
export function SproutStrip({ fx }: { fx: Fx }) {
  const [show, setShow] = useState(fx === "sprout");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("fx") === "sprout") setShow(true);
  }, []);
  const sprouts = [6, 14, 23, 31, 42, 50, 61, 69, 78, 86, 94];
  if (!show) return null;
  return (
    <div aria-hidden className="sprout-strip pointer-events-none relative -mb-1 h-6 overflow-hidden">
      {sprouts.map((left, i) => (
        <span key={left} className="sprout" style={{ left: `${left}%`, animationDelay: `${(i % 4) * 0.35}s, ${2 + (i % 3) * 0.5}s` }}>
          <svg viewBox="0 0 20 24" width="16" height="20">
            <path d="M10 24 C10 16 10 12 10 9" stroke="#22c55e" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M10 11 C6 11 3 8 3 4 C7 4 10 7 10 11Z" fill="#4ade80" />
            <path d="M10 9 C14 9 17 6 17 2 C13 2 10 5 10 9Z" fill="#22c55e" />
          </svg>
        </span>
      ))}
    </div>
  );
}
