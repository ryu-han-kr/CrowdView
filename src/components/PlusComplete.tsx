"use client";

import Link from "@/i18n/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { subscribePlus } from "@/lib/plus-browser";

/** 결제 마무리: 토스 카드 등록창에서 돌아온 authKey로 첫 달을 결제한다 (실패·취소면 ?code=…&message=…) */
export function PlusComplete() {
  const { t } = useI18n();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(location.search);
    const authKey = q.get("authKey");
    const customerKey = q.get("customerKey");
    if (q.get("code") || !authKey || !customerKey) {
      setMessage(q.get("message") ?? t("카드 등록이 취소됐어요"));
      return setState("error");
    }
    // 새로고침해도 같은 authKey로 두 번 보내지 않게 주소에서 지운다
    history.replaceState(null, "", location.pathname);
    subscribePlus(authKey, customerKey)
      .then(() => setState("done"))
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : String(e));
        setState("error");
      });
  }, [t]);

  if (state === "working") return <p className="text-sm text-gray-500">{t("결제를 마무리하는 중이에요…")}</p>;
  if (state === "error")
    return (
      <>
        <p className="text-4xl">😥</p>
        <h1 className="mt-3 text-xl font-bold">{t("결제를 마치지 못했어요")}</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <Link href="/pricing" className="mt-6 inline-block rounded-2xl bg-gray-900 px-5 py-3 text-sm font-bold text-white">
          {t("다시 시도")}
        </Link>
      </>
    );
  return (
    <>
      <p className="text-4xl">🎉</p>
      <h1 className="mt-3 text-xl font-bold">{t("Plus를 시작했어요")}</h1>
      <p className="mt-2 text-sm text-gray-500">{t("이제 광고 없이 보고, 장소 상세에서 혼잡 알림을 켤 수 있어요.")}</p>
      <Link href="/" className="mt-6 inline-block rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">
        {t("홈으로")}
      </Link>
    </>
  );
}
