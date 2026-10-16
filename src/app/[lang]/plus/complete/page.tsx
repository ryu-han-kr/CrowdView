import type { Metadata } from "next";
import { PlusComplete } from "@/components/PlusComplete";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  return pageMeta({ lang, path: "/plus/complete", title: getT(lang)("Plus 결제"), noindex: true });
}

// 모바일 카드 등록 후 돌아오는 곳 (?billingKey=…), PC 결제 완료 후 안내 (?ok=1)
export default function Page() {
  return (
    <main className="px-5 pt-16 pb-16 md:px-0">
      <div className="mx-auto max-w-sm text-center">
        <PlusComplete />
      </div>
    </main>
  );
}
