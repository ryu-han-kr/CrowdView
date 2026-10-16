import type { Metadata } from "next";
import Link from "@/i18n/link";
import { SocialLoginButtons } from "@/components/AuthButtons";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { authEnabled, enabledProviders } from "@/lib/auth";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  return pageMeta({ lang, path: "/login", title: getT(lang)("로그인"), noindex: true });
}

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  return (
    <main className="px-5 pt-10 pb-12 md:px-0 md:pt-16">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">{t("로그인")}</h1>
        <p className="mt-2 text-sm text-gray-500">{t("로그인하면 찜한 장소가 모든 기기에서 같이 보이고, Plus와 혼잡 알림을 쓸 수 있어요.")}</p>
        <div className="mt-8">
          <SocialLoginButtons providers={authEnabled ? enabledProviders : []} />
        </div>
        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          {t("시작하면")}{" "}
          <Link href="/terms" className="underline">
            {t("이용약관")}
          </Link>
          {t("과")}{" "}
          <Link href="/privacy" className="underline">
            {t("개인정보처리방침")}
          </Link>
          {t("에 동의한 것으로 봐요. 비밀번호는 받지 않아요.")}
        </p>
      </div>
    </main>
  );
}
