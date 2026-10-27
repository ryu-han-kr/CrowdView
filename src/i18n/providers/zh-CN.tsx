"use client";

// zh-CN 사전을 묶은 제공자. lazy-provider.tsx 가 next/dynamic 으로 불러 사전이 HTML(RSC 데이터) 대신 캐시되는 JS 조각으로 간다
import { I18nProvider } from "../client";
import dict from "../dict/zh-CN";

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider lang="zh-CN" dict={dict}>
      {children}
    </I18nProvider>
  );
}
