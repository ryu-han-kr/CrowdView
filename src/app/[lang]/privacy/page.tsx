import type { Metadata } from "next";
import { LegalDocView } from "@/components/LegalDocView";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { PRIVACY } from "@/lib/legal";
import { PRIVACY_EN } from "@/lib/legal-en";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  return pageMeta({ lang, path: "/privacy", title: getT(lang)("개인정보처리방침") });
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  // 외국어 화면은 영어 번역본 (한국어 원문이 기준, Paddle 사이트 심사 10/28)
  const lang = (await params).lang as Lang;
  return <LegalDocView doc={lang === "ko" ? PRIVACY : PRIVACY_EN} lang={lang} />;
}
