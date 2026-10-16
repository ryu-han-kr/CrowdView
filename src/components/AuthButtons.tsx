"use client";

import Link from "@/i18n/link";
import { useI18n } from "@/i18n/client";
import { signIn, signOut, useSession } from "@/lib/auth-client";

/** 카카오·구글 로그인 버튼 (켜진 수단만) */
export function SocialLoginButtons({ providers, callbackURL = "/me" }: { providers: ("kakao" | "google")[]; callbackURL?: string }) {
  const { t, lp } = useI18n();
  if (!providers.length) return <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">{t("로그인 준비 중이에요.")}</p>;
  return (
    <div className="space-y-2.5">
      {providers.includes("kakao") && (
        <button
          onClick={() => signIn.social({ provider: "kakao", callbackURL: lp(callbackURL) })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] py-3.5 text-sm font-bold text-[#191919]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3Z" />
          </svg>
          {t("카카오로 시작하기")}
        </button>
      )}
      {providers.includes("google") && (
        <button
          onClick={() => signIn.social({ provider: "google", callbackURL: lp(callbackURL) })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3.5 text-sm font-bold text-gray-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
          </svg>
          {t("Google로 시작하기")}
        </button>
      )}
    </div>
  );
}

/** PC 상단 메뉴: 로그인 / 내 프로필 (로그인 기능이 꺼져 있으면 아무것도 안 그림) */
export function NavAuth({ enabled }: { enabled: boolean }) {
  return enabled ? <NavAuthInner /> : null;
}

function NavAuthInner() {
  const { t } = useI18n();
  const { data } = useSession();
  const user = data?.user;
  return user ? (
    <Link href="/me" className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-gray-700">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs text-indigo-700">{user.name.slice(0, 1)}</span>
      )}
    </Link>
  ) : (
    <Link href="/login" className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white">
      {t("로그인")}
    </Link>
  );
}

export function LogoutButton() {
  const { t } = useI18n();
  return (
    <button
      onClick={async () => {
        await signOut();
        location.reload();
      }}
      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
    >
      {t("로그아웃")}
    </button>
  );
}
