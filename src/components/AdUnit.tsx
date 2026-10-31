"use client";

import { useEffect, useRef } from "react";
import { usePlus } from "@/lib/plus-client";
import { useI18n } from "@/i18n/client";
import { trackAd } from "./TrafficBeacon";

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
  name,
  format = "auto",
  className = "",
  style,
  fallback = null,
}: {
  slot?: string;
  /** 이용 집계용 칸 이름 (lib/traffic AD_SLOT_NAMES) */
  name: "rail" | "inline";
  format?: "auto" | "vertical" | "horizontal" | "rectangle";
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}) {
  const plus = usePlus();
  const ref = useRef<HTMLModElement>(null);
  const ready = !!ADSENSE_CLIENT && !!slot && !plus;

  useEffect(() => {
    const el = ref.current;
    if (!ready || !el || el.dataset.adsbygoogleStatus) return;
    // 화면에 안 보이는 칸(PC 옆 레일은 1536px 미만에서 숨김)에 광고를 요청하면 애드센스가 'No slot size for availableWidth=0' 오류를 낸다 → 폭이 0이면 요청하지 않는다
    if (!el.offsetWidth) return;
    // 광고가 실제로 채워지면(data-ad-status="filled") 한 번 센다 — 애드센스 수익은 채워진 노출 기준
    const seen = new MutationObserver(() => {
      if (el.dataset.adStatus === "filled") {
        trackAd(name);
        seen.disconnect();
      } else if (el.dataset.adStatus === "unfilled") seen.disconnect();
    });
    seen.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 실패해도 화면은 그대로
    }
    return () => seen.disconnect();
  }, [ready, name]);

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

/**
 * 본문 사이 광고 (휴대폰·PC 모두). 설정 전이거나 Plus 회원이면 아무것도 없음 → 화면 그대로.
 * 혼잡도 카드 근처에는 두지 않고 화면 아래쪽(본문 다 본 뒤)에 한 개만. 자리를 미리 잡아 광고가 늦게 떠도 화면이 밀리지 않게
 */
export function InlineAd({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const plus = usePlus();
  if (!ADSENSE_CLIENT || !AD_SLOTS.inline || plus) return null;
  return (
    <aside aria-label={t("광고")} className={className}>
      {/* gray-400은 흰 바탕 대비 2.6 → 라이트하우스 접근성 감점 (10/31), gray-500으로 */}
      <p className="mb-1 text-[10px] text-gray-500">{t("광고")}</p>
      <AdUnit slot={AD_SLOTS.inline} name="inline" className="min-h-[100px]" />
    </aside>
  );
}
