"use client";

// next/link 대신 쓰는 링크: 내부 주소에 현재 언어 접두사를 붙인다
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "./client";

export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const { lp } = useI18n();
  return <NextLink href={typeof href === "string" ? lp(href) : href} {...props} />;
}
