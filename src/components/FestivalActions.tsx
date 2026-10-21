"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { shareUrl } from "@/components/ShareListButtons";
import { Glyph } from "@/components/Glyph";

/** 축제 기간을 하루 종일 일정으로 담은 캘린더 파일(.ics). 끝 날짜는 iCalendar 규칙대로 다음 날(포함 안 함) */
export function festivalIcs(f: { id: string; title: string; start: string; end: string; place?: string; url: string }): string {
  const day = (d: string) => d.replaceAll("-", "");
  const next = new Date(Date.parse(`${f.end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  // iCalendar 글자 규칙: 쉼표·세미콜론·역슬래시 앞에 역슬래시
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrowdView//Festival//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:festival-${f.id}@crowdview.app`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${day(f.start)}`,
    `DTEND;VALUE=DATE:${day(next)}`,
    `SUMMARY:${esc(f.title)}`,
    ...(f.place ? [`LOCATION:${esc(f.place)}`] : []),
    `URL:${f.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** 축제 상세: 공유(휴대폰 공유창, PC는 링크 복사) · 캘린더에 넣기(.ics) */
export function FestivalActions({ id, title, start, end, place }: { id: string; title: string; start: string; end: string; place?: string }) {
  const { t, lp } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = () => `${location.origin}${lp(`/festival/${id}`)}`;
  const download = () => {
    const blob = new Blob([festivalIcs({ id, title, start, end, place, url: url() })], { type: "text/calendar" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `crowdview-festival-${id}.ics`;
    a.click();
    URL.revokeObjectURL(href);
  };
  const btn = "inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700";
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={async () => setCopied(await shareUrl(url(), title))}>
        <Glyph e="🔗" className="h-3.5 w-3.5" />
        {copied ? t("링크를 복사했어요") : t("공유")}
      </button>
      <button type="button" className={btn} onClick={download}>
        <Glyph e="📅" className="h-3.5 w-3.5" />
        {t("캘린더에 넣기")}
      </button>
    </div>
  );
}
