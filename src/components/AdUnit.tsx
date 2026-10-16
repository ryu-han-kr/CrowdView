"use client";

import { useEffect, useRef } from "react";
import { usePlus } from "@/lib/plus-client";

// Google AdSense. 발행자 ID(ca-pub-…)와 광고 단위 ID는 애드센스 콘솔에서 만든 뒤 환경변수로 넣는다
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
export const AD_SLOTS = {
  /** PC 양옆 세로 160×600 */
  rail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL,
  /** 본문 사이 반응형 */
  inline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE,
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 광고 한 칸. 애드센스 설정이 없거나 Plus 회원이면 아무것도 그리지 않는다 (fallback은 설정 전 자리 표시)
 */
export function AdUnit({
  slot,
  format = "auto",
  className = "",
  style,
  fallback = null,
}: {
  slot?: string;
  format?: "auto" | "vertical" | "horizontal" | "rectangle";
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}) {
  const plus = usePlus();
  const ref = useRef<HTMLModElement>(null);
  const ready = !!ADSENSE_CLIENT && !!slot && !plus;

  useEffect(() => {
    if (!ready || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 실패해도 화면은 그대로
    }
  }, [ready]);

  if (plus) return null;
  if (!ready) return <>{fallback}</>;
  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className}`}
      style={{ display: "block", ...style }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

/** 본문 사이 광고 (설정 전에는 아무것도 없음 → 모바일 화면 그대로) */
export function InlineAd({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <AdUnit slot={AD_SLOTS.inline} />
    </div>
  );
}
