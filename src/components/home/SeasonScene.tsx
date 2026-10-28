"use client";

import { useEffect, useState } from "react";
import type { Scene } from "@/lib/season-fx";

/**
 * 홈 위쪽 배경 풍경 (경수님 10/28: 가을 단풍나무·겨울 눈마을과 눈사람·여름 해수욕장·봄 벚나무 아래 책 읽는 사람).
 * 그림은 Figma AI로 만든 수채 일러스트(public/scenes, 큰 판 1584px·작은 판 900px webp, 10~56KB).
 * 처음 화면을 다 그린 뒤(브라우저가 한가할 때) 받아 천천히 나타나게 — LCP(가장 큰 그림)가 되지 않게.
 * 떨어지는 효과(SeasonBackdrop) 뒤, 사진·카드 뒤. 하늘은 잘라 내고 땅·나무가 있는 아래쪽이 제목 줄 뒤(배너 바로 위)에 오게
 */
export function SeasonScene({ scene: given }: { scene: Scene }) {
  const [scene, setScene] = useState(given);
  const [on, setOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // 미리 보기: 주소 뒤 ?scene=winter 처럼
    const q = new URLSearchParams(location.search).get("scene");
    if (q === "autumn" || q === "winter" || q === "summer" || q === "spring") setScene(q);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
    const id = idle(() => setOn(true));
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id as number) : clearTimeout(id as number));
  }, []);
  if (!on) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-1/2 -z-20 h-[300px] w-screen -translate-x-1/2 overflow-hidden md:h-[230px] [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
    >
      <picture>
        <source media="(max-width: 767px)" srcSet={`/scenes/${scene}.sm.webp`} />
        {/* eslint-disable-next-line @next/next/no-img-element -- 장식용 배경, 이미지 최적화 서버를 거치지 않는다 */}
        <img
          src={`/scenes/${scene}.webp`}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          // 휴대폰은 나무·집이 있는 오른쪽, PC는 가운데. 아래(땅)에 맞춰 위(하늘)를 자른다
          className={`h-full w-full object-cover object-[85%_100%] transition-opacity duration-1000 md:object-bottom ${loaded ? "opacity-60 md:opacity-80" : "opacity-0"}`}
        />
      </picture>
      {/* 제목·설명 글자 뒤는 옅은 흰 막으로 (그림이 진한 곳에서도 글자가 잘 읽히게) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_30%_55%,rgba(255,255,255,0.75),transparent_70%)] md:bg-[radial-gradient(ellipse_35%_60%_at_25%_50%,rgba(255,255,255,0.8),transparent_75%)]" />
    </div>
  );
}
