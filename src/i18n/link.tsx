"use client";

// next/link 대신 쓰는 링크: 내부 주소에 현재 언어 접두사를 붙인다.
// 미리 받기(prefetch)는 페이지가 다 뜨고 한가해진 뒤에 켠다 (10/23 Lighthouse: 홈 목록의 장소 링크가 보이자마자
// 장소 상세 코드(차트·애니메이션 약 290KB)를 받아 휴대폰 첫 화면 LCP가 3초 → 5~9초). 그 뒤엔 보통처럼 화면에 보이면 미리 받는다
import NextLink from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";
import { useI18n } from "./client";

let ready = false;
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
if (typeof window !== "undefined") {
  const markReady = () => {
    ready = true;
    listeners.forEach((fn) => fn());
  };
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(markReady, { timeout: 5000 }) : setTimeout(markReady, 3000));
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

export default function Link({ href, prefetch, ...props }: ComponentProps<typeof NextLink>) {
  const { lp } = useI18n();
  const idle = useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
  return <NextLink href={typeof href === "string" ? lp(href) : href} prefetch={idle ? prefetch : false} {...props} />;
}
