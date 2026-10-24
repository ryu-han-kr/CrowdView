"use client";

import { useI18n } from "@/i18n/client";
import { ADSENSE_CLIENT, AD_SLOTS, AdUnit } from "./AdUnit";

/**
 * PC 양옆 세로 광고 칸 (160×600). 가운데 콘텐츠(1152px) 바깥에 여유가 있는 2xl(1536px) 이상에서만 보인다.
 * 휴대폰 화면에는 나오지 않는다(휴대폰은 InlineAd). 애드센스 설정(AdUnit)이 있으면 광고, 없으면 개발·미리보기에서만 자리 표시
 * (운영에서 키가 없을 때 이용자에게 빈 점선 상자가 보였다, 10/24), Plus 회원은 숨김.
 */
export function AdRail({ side, slot = AD_SLOTS.rail }: { side: "left" | "right"; slot?: string }) {
  const { t } = useI18n();
  if (!ADSENSE_CLIENT && process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return null;
  return (
    <aside
      aria-label={t("광고")}
      className="fixed top-24 z-30 hidden w-[160px] 2xl:block"
      style={side === "left" ? { right: "calc(50% + 576px + 24px)" } : { left: "calc(50% + 576px + 24px)" }}
    >
      <AdUnit
        slot={slot}
        name="rail"
        format="vertical"
        style={{ width: 160, height: 600 }}
        fallback={
          <div className="flex h-[600px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center text-xs text-gray-500">
            <span className="font-semibold">{t("광고 영역")}</span>
            <span>160 × 600</span>
          </div>
        }
      />
    </aside>
  );
}
