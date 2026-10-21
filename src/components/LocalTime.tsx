"use client";

// 외국어 화면에서 한국 시각 옆에 '보는 사람 나라의 시각'을 함께 보여 준다.
// 장소는 한국에 있으니 화면의 시각은 그대로 한국 시간(KST)이고, 이 컴포넌트가 덧붙이기만 한다.
// 시간대는 브라우저만 알 수 있어서 서버 화면에는 아무것도 없고, 열린 뒤에 붙는다 (한국어 화면·한국 시간대면 그대로 없음)
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Glyph } from "@/components/Glyph";

const KST_OFFSET_MIN = 9 * 60;

/** 브라우저 시간대가 한국과 다를 때만 그 Intl 형식기를 돌려준다 */
function useViewerZone() {
  const { lang } = useI18n();
  const [zone, setZone] = useState<{ fmt: Intl.DateTimeFormat; day: Intl.DateTimeFormat; name: string } | null>(null);
  useEffect(() => {
    if (lang === "ko" || -new Date().getTimezoneOffset() === KST_OFFSET_MIN) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setZone({
      fmt: new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hour12: false }),
      day: new Intl.DateTimeFormat(lang, { weekday: "short" }),
      name: tz?.split("/").at(-1)?.replace(/_/g, " ") ?? "",
    });
  }, [lang]);
  return zone;
}

/** 한국 기준 오늘 0시(UTC ms) */
function kstMidnight(): number {
  const d = new Date(Date.now() + KST_OFFSET_MIN * 60_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - KST_OFFSET_MIN * 60_000;
}

/** 내 시간대의 시각. 한국과 날짜가 다르면 요일을 붙인다 */
function localLabel(zone: NonNullable<ReturnType<typeof useViewerZone>>, kstMin: number): string {
  const at = new Date(kstMidnight() + kstMin * 60_000);
  const kstDay = new Date(at.getTime() + KST_OFFSET_MIN * 60_000).getUTCDay();
  const sameDay = at.getDay() === kstDay;
  return `${sameDay ? "" : `${zone.day.format(at)} `}${zone.fmt.format(at)}`;
}

/**
 * 한국 시각 뒤에 " (내 시간 01:00)"을 붙인다.
 * hour: 한국 시각(14.5 = 14:30, 24 넘으면 다음 날), to: 범위 끝, dayOffset: 오늘부터 며칠 뒤
 */
export function LocalTime({ hour, to, dayOffset = 0 }: { hour: number; to?: number; dayOffset?: number }) {
  const { t } = useI18n();
  const zone = useViewerZone();
  if (!zone) return null;
  const base = dayOffset * 1440;
  const time = localLabel(zone, base + hour * 60) + (to === undefined ? "" : `–${localLabel(zone, base + to * 60)}`);
  return <span className="text-gray-500"> ({t("내 시간 {time}", { time })})</span>;
}

/** 시각이 많은 화면 위에 한 줄: "이 페이지의 시각은 한국 시간(KST)이에요 · 한국 지금 14:05 · 내 시간(뉴욕) 01:05" */
export function KstNote({ className = "" }: { className?: string }) {
  const { t, lang } = useI18n();
  const zone = useViewerZone();
  if (!zone) return null;
  const now = new Date();
  const kstNow = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(now);
  return (
    <p className={`text-[11px] text-gray-500 ${className}`}>
      <Glyph e="🕒" /> {t("이 페이지의 시각은 한국 시간(KST)이에요")} · {t("한국 지금 {time}", { time: kstNow })} ·{" "}
      {t("내 시간({zone}) {time}", { zone: zone.name, time: zone.fmt.format(now) })}
    </p>
  );
}
