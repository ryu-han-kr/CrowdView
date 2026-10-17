"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 운영 도구의 구독자 한 줄: 해지 · 전액 환불 · 일부 환불 (누르기 전에 한 번 더 확인) */
export function AdminActions({ userId, label }: { userId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "cancel" | "refund"; amount?: number }>(null);
  const [partial, setPartial] = useState("");

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/${confirm.kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, amount: confirm.amount, reason: confirm.kind === "refund" ? "고객센터 환불 요청" : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMsg("완료");
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (confirm)
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <b className="text-red-600">
          {label}: {confirm.kind === "cancel" ? "해지" : confirm.amount ? `${confirm.amount.toLocaleString()}원 환불` : "전액 환불"}할까요?
        </b>
        <button disabled={busy} onClick={run} className="rounded-lg bg-red-600 px-2 py-1 font-bold text-white">
          {busy ? "처리 중…" : "확인"}
        </button>
        <button onClick={() => setConfirm(null)} className="rounded-lg bg-gray-100 px-2 py-1">
          취소
        </button>
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      <button onClick={() => setConfirm({ kind: "cancel" })} className="rounded-lg bg-gray-100 px-2 py-1">
        해지
      </button>
      <button onClick={() => setConfirm({ kind: "refund" })} className="rounded-lg bg-gray-100 px-2 py-1">
        전액 환불
      </button>
      <input
        value={partial}
        onChange={(e) => setPartial(e.target.value.replace(/\D/g, ""))}
        placeholder="금액"
        className="w-16 rounded-lg border border-gray-200 px-1.5 py-1"
      />
      <button disabled={!partial} onClick={() => setConfirm({ kind: "refund", amount: Number(partial) })} className="rounded-lg bg-gray-100 px-2 py-1 disabled:opacity-40">
        일부 환불
      </button>
      {msg && <span className="text-gray-500">{msg}</span>}
    </span>
  );
}
