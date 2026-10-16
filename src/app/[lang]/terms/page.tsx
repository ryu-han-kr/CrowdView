import type { Metadata } from "next";
import { LegalDocView } from "@/components/LegalDocView";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { TERMS } from "@/lib/legal";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  return pageMeta({ lang, path: "/terms", title: getT(lang)("이용약관") });
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <LegalDocView doc={TERMS} lang={(await params).lang as Lang} />;
}
