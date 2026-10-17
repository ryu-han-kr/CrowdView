"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { usePicks, type Pick } from "@/lib/prefs";

/** 공유된 코스의 장소들을 내 ☆ 담은 곳으로 옮기고 코스 추천으로 간다 (그 장소들로 내 일정에 맞춰 다시 짜기) */
export function CopyRouteButton({ stops }: { stops: Pick[] }) {
  const { t, lp } = useI18n();
  const router = useRouter();
  const { picks, replace } = usePicks();
  const copy = () => {
    // 이미 담은 곳은 두고, 공유 코스 장소를 앞에 (코스는 최대 6곳까지 먼저 넣는다)
    replace([...stops, ...picks.filter((p) => !stops.some((s) => s.id === p.id))]);
    router.push(lp("/route"));
  };
  return (
    <button onClick={copy} className="mt-3 block w-full rounded-2xl border border-indigo-200 bg-white py-3.5 text-center text-sm font-bold text-indigo-700">
      ⭐ {t("이 코스 장소를 담아서 내 일정으로 짜기")}
    </button>
  );
}
