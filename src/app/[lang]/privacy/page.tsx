import type { Metadata } from "next";
import { LegalDocView } from "@/components/LegalDocView";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { PRIVACY } from "@/lib/legal";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return { title: getT((await params).lang)("개인정보처리방침") };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  return <LegalDocView doc={PRIVACY} lang={(await params).lang as Lang} />;
}
