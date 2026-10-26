"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// 찜·담은 곳·계획 동기화 (로그인 SDK better-auth 34KB 포함)는 첫 화면에 필요 없다 → 화면이 뜨고 한가할 때 불러온다 (10/26 성능)
const FavoritesSync = dynamic(() => import("./FavoritesSync").then((m) => m.FavoritesSync), { ssr: false });
const PicksSync = dynamic(() => import("./PicksSync").then((m) => m.PicksSync), { ssr: false });
const PlansSync = dynamic(() => import("./PlansSync").then((m) => m.PlansSync), { ssr: false });

export function LazySyncs() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const go = () => setOn(true);
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 2000));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  }, []);
  if (!on) return null;
  return (
    <>
      <FavoritesSync />
      <PicksSync />
      <PlansSync />
    </>
  );
}
