"use client";

import { useEffect, useRef, useState } from "react";
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
  onStatus,
}: {
  slot?: string;
  /** 이용 집계용 칸 이름 (lib/traffic AD_SLOT_NAMES) */
  name: "rail" | "inline";
  /** null이면 애드센스가 칸 크기를 바꾸지 않고 CSS로 잡은 크기 안에서 광고를 고른다 (InlineAd) */
  format?: "auto" | "vertical" | "horizontal" | "rectangle" | null;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
  /** 애드센스가 채움 결과를 알려 줄 때 */
  onStatus?: (status: "filled" | "unfilled") => void;
}) {
  const plus = usePlus();
  const ref = useRef<HTMLModElement>(null);
  const report = useRef(onStatus);
  useEffect(() => {
    report.current = onStatus;
  });
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
        report.current?.("filled");
        seen.disconnect();
      } else if (el.dataset.adStatus === "unfilled") {
        report.current?.("unfilled");
        seen.disconnect();
      }
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
      data-ad-format={format ?? undefined}
      data-full-width-responsive={format ? "true" : undefined}
    />
  );
}

/** 본문 광고 칸 높이. 어떤 광고가 와도 이 안에서만 그려져 아래 내용이 밀리지 않는다 */
const INLINE_AD_HEIGHT = 250;
/** 광고 차단 등으로 결과가 끝내 오지 않으면 빈 칸으로 본다 */
const INLINE_AD_GIVE_UP_MS = 12000;

/**
 * 본문 사이 광고 (휴대폰·PC 모두). 설정 전이거나 Plus 회원이면 아무것도 없음 → 화면 그대로.
 * 혼잡도 카드 근처에는 두지 않고 화면 아래쪽(본문 다 본 뒤)에 한 개만.
 * 실사용 CLS 양호가 49%라 측정해 보니(11/2) 칸이 100px → 280~412px로 커졌다가 광고가 안 채워지면 0으로 접히며 내용을 밀었다.
 * 그래서 높이를 고정하고, 빈 칸은 화면 밖으로 나갔을 때만 접는다 (10/27 빈 칸이 그대로 보인다는 지적이 있어 끝까지 남기지는 않는다).
 */
export function InlineAd({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const plus = usePlus();
  const box = useRef<HTMLElement>(null);
  const [empty, setEmpty] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const on = !!ADSENSE_CLIENT && !!AD_SLOTS.inline && !plus;

  useEffect(() => {
    if (!on || empty) return;
    const timer = setTimeout(() => setEmpty(true), INLINE_AD_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [on, empty]);

  useEffect(() => {
    const el = box.current;
    if (!empty || collapsed || !el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) return;
      // 화면 위쪽 칸을 접으면 사파리(스크롤 앵커링 없음)에서 내용이 튄다 → 접은 만큼 스크롤을 되돌린다
      const css = getComputedStyle(el);
      const jump = e.boundingClientRect.bottom <= 0 && !CSS.supports("overflow-anchor", "auto") ? el.offsetHeight + parseFloat(css.marginTop) + parseFloat(css.marginBottom) : 0;
      setCollapsed(true);
      if (jump) requestAnimationFrame(() => window.scrollBy(0, -jump));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [empty, collapsed]);

  if (!on || collapsed) return null;
  return (
    <aside ref={box} aria-label={t("광고")} className={className}>
      {/* gray-400은 흰 바탕 대비 2.6 → 라이트하우스 접근성 감점 (10/31), gray-500으로 */}
      <p className={`mb-1 text-[10px] text-gray-500 ${empty ? "invisible" : ""}`}>{t("광고")}</p>
      <div className={`overflow-hidden rounded-xl ${empty ? "" : "bg-gray-50"}`} style={{ height: INLINE_AD_HEIGHT }}>
        <AdUnit slot={AD_SLOTS.inline} name="inline" format={null} style={{ width: "100%", height: INLINE_AD_HEIGHT }} onStatus={(status) => setEmpty(status === "unfilled")} />
      </div>
    </aside>
  );
}
