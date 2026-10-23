"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

export interface DroneVideo {
  id: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  thumb: string;
  hls: string;
  place: string;
  date: string;
}

/**
 * 관광공사 드론 영상 (src/data/korea/kto-videos.json). 썸네일만 보여 주고, 누른 영상만 관광공사 CDN에서 불러 재생한다
 * (1080p 한 가지라 자동 재생하지 않는다). 사파리는 HLS를 바로 재생하고, 나머지 브라우저는 그때 hls.js를 따로 불러온다
 */
export function DroneVideos({ videos, className = "" }: { videos: DroneVideo[]; className?: string }) {
  const { t, lang } = useI18n();
  const [playing, setPlaying] = useState<string | null>(null);
  if (!videos.length) return null;
  const ko = lang === "ko";
  return (
    <section className={className}>
      <h2 className="text-xl font-extrabold tracking-tight">{t("드론 영상")}</h2>
      <div className="no-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {videos.map((v) => (
          <figure key={v.id} className="w-[78%] shrink-0 snap-start md:w-auto">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900">
              {playing === v.id ? (
                <Player src={v.hls} poster={v.thumb} />
              ) : (
                <button onClick={() => setPlaying(v.id)} className="group absolute inset-0" aria-label={`${t("재생")}: ${ko ? v.title : v.titleEn || v.title}`}>
                  {/* 관광공사 썸네일 주소는 이미지 최적화 대상이 아니라 그대로 쓴다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                      <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
            <figcaption className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-gray-600">{(ko ? v.desc : v.descEn) || v.place}</figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">{t("영상: 한국관광공사 (공공누리 제1유형)")}</p>
    </section>
  );
}

function Player({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
      return;
    }
    let hls: { destroy(): void } | undefined;
    let gone = false;
    import("hls.js").then(({ default: Hls }) => {
      if (gone || !Hls.isSupported()) return;
      const h = new Hls();
      h.loadSource(src);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls = h;
    });
    return () => {
      gone = true;
      hls?.destroy();
    };
  }, [src]);
  return <video ref={ref} poster={poster} controls playsInline muted className="h-full w-full object-cover" />;
}
