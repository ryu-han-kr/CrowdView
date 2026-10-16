"use client";

import Link from "@/i18n/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { authClient, useSession } from "@/lib/auth-client";
import { LogoutButton } from "./AuthButtons";

/** 마이페이지 계정 칸: 로그인 전에는 로그인 안내, 로그인 후에는 프로필·로그아웃·탈퇴 */
export function AccountCard({ enabled, plusSlot }: { enabled: boolean; plusSlot?: React.ReactNode }) {
  return enabled ? <Inner plusSlot={plusSlot} /> : null;
}

function Inner({ plusSlot }: { plusSlot?: React.ReactNode }) {
  const { t } = useI18n();
  const { data, isPending } = useSession();
  const [confirming, setConfirming] = useState(false);
  const user = data?.user;
  if (isPending) return <div className="h-20 animate-pulse rounded-3xl bg-gray-50" />;
  if (!user)
    return (
      <Link href="/login" className="flex items-center justify-between rounded-3xl border border-gray-100 px-4 py-4">
        <span>
          <span className="block text-sm font-bold">{t("로그인하고 찜을 모든 기기에서 보기")}</span>
          <span className="block text-xs text-gray-500">{t("카카오·Google 계정으로 3초면 끝나요")}</span>
        </span>
        <span className="text-sm font-semibold text-indigo-600">{t("로그인")} ›</span>
      </Link>
    );
  return (
    <section className="rounded-3xl border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
            {user.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user.name}</p>
          {!user.email.endsWith("@users.crowdview.app") && <p className="truncate text-xs text-gray-500">{user.email}</p>}
        </div>
        <LogoutButton />
      </div>
      {plusSlot}
      <div className="mt-4 text-right">
        {confirming ? (
          <span className="text-xs">
            {t("정말 탈퇴할까요? 찜·알림이 모두 지워져요.")}{" "}
            <button
              onClick={async () => {
                await authClient.deleteUser();
                location.href = "/";
              }}
              className="font-bold text-red-600"
            >
              {t("탈퇴")}
            </button>{" "}
            <button onClick={() => setConfirming(false)} className="text-gray-500">
              {t("취소")}
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-[11px] text-gray-400 underline">
            {t("회원 탈퇴")}
          </button>
        )}
      </div>
    </section>
  );
}
