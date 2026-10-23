"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면에 거의 다 왔을 때(200px 앞)만 받는 사진. 줄여 보낼 수 없는 원본(서울시 문화 사이트 포스터, 최대 786KB) 전용.
 * 브라우저 기본 loading="lazy"는 느린 회선일수록 2,500px 앞까지 미리 받아, 휴대폰 축제 목록 첫 화면이 16초 걸렸다 (10/23 Lighthouse)
 */
export function NearImg({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return setShow(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={show ? src : undefined} alt={alt} decoding="async" className={className} />;
}
