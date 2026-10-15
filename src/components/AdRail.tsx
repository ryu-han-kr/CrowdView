/**
 * PC 양옆 세로 광고 칸 (160×600). 가운데 콘텐츠(1152px) 바깥에 여유가 있는 2xl(1536px) 이상에서만 보인다.
 * 모바일·앱 화면에는 나오지 않는다. 광고 네트워크(예: Google AdSense)를 붙일 때 slot 자리에 광고 태그를 넣는다.
 */
export function AdRail({ side, slot }: { side: "left" | "right"; slot?: string }) {
  return (
    <aside
      aria-label="광고"
      className="fixed top-24 z-30 hidden w-[160px] 2xl:block"
      style={side === "left" ? { right: "calc(50% + 576px + 24px)" } : { left: "calc(50% + 576px + 24px)" }}
    >
      <div
        data-ad-slot={slot}
        className="flex h-[600px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center text-xs text-gray-400"
      >
        <span className="font-semibold">광고 영역</span>
        <span>160 × 600</span>
      </div>
    </aside>
  );
}
