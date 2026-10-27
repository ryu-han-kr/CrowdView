/**
 * 실시간 표시 한 가지 (10/27 홈 2차: 빨간 사각·인디고 알약 두 가지가 섞여 있었다 → 인디고 알약 + 초록 점).
 * shape=flat 은 배너처럼 다른 꼬리표와 붙여 쓸 때 (모서리는 바깥 상자가 깎는다)
 */
export function LiveBadge({ className = "", shape = "pill" }: { className?: string; shape?: "pill" | "flat" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 bg-indigo-600 font-bold text-white ${shape === "pill" ? "rounded-full px-1.5 py-px text-[10px]" : "px-2 py-0.5"} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      LIVE
    </span>
  );
}
