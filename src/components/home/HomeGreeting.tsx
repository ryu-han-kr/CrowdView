import type { ReactNode } from "react";
import Link from "@/i18n/link";
import type { T } from "@/i18n/translate";
import { crowdPose, poseMotionClass } from "@/lib/characters";
import { levelOf } from "@/lib/levels";
import { Character } from "@/components/Character";

const LINE: Record<number, string> = {
  1: "지금 서울은 한산해요",
  2: "지금 서울은 여유로운 편이에요",
  3: "지금 서울은 평소 수준이에요",
  4: "지금 서울은 붐비는 편이에요",
  5: "지금 서울은 많이 붐벼요",
};

/**
 * 홈 첫 화면 인사 카드 (사용자 10/24: 홈에도 캐릭터). 서울 실시간 지역의 가운데 점수로 햄스터 표정이 바뀌고,
 * 한산한 곳·붐비는 곳 수와 갱신 시각(LIVE)을 함께 보여 준다. 새벽(0~6시)엔 조는 햄스터
 */
export function HomeGreeting({ scores, hour, live, t }: { scores: number[]; hour: number; live: ReactNode; t: T }) {
  const mid = [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)];
  const lv = levelOf(mid);
  const night = hour < 6;
  const calm = scores.filter((s) => levelOf(s).key <= 2).length;
  const busy = scores.filter((s) => levelOf(s).key >= 4).length;
  return (
    <Link
      href="/seoul"
      className="mt-3 flex items-center gap-3 overflow-hidden rounded-3xl py-2 pr-4 pl-2 md:mt-4"
      style={{ background: `color-mix(in oklab, ${lv.color} 13%, var(--surface, #fff))` }}
    >
      <Character name="hamster" pose={night ? "wait" : crowdPose(mid)} size={96} priority className={`${night ? "mascot-bob" : poseMotionClass(crowdPose(mid))} -my-1 shrink-0`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] leading-snug font-extrabold">{night ? t("늦은 밤, 서울은 조용히 쉬는 중") : t(LINE[lv.key])}</span>
        <span className="mt-0.5 block text-sm text-gray-700">
          {t("한산한 곳 {calm}곳 · 붐비는 곳 {busy}곳", { calm, busy })} <span className="text-gray-400">›</span>
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-600">{live}</span>
      </span>
    </Link>
  );
}
