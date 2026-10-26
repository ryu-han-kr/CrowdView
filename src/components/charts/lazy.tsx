"use client";

import dynamic from "next/dynamic";

/**
 * 차트는 화면이 연결(hydration)된 뒤에 따로 받는다 (10/26 성능: Bklit·motion 묶음 180KB가 장소 상세 첫 그림과 경쟁했다).
 * 서버에서는 같은 높이의 빈 칸을 그려 두어 받아지는 동안 화면이 밀리지 않는다 (HourlyChart는 위 상세 상자 72px + 2:1 그래프)
 */
const Box = ({ className }: { className: string }) => <div aria-hidden className={`rounded-2xl bg-gray-50 ${className}`} />;

export const HourlyChart = dynamic(() => import("@/components/HourlyChart").then((m) => m.HourlyChart), {
  ssr: false,
  loading: () => (
    <div>
      <Box className="mb-2 h-[72px]" />
      <Box className="aspect-[2/1] w-full" />
    </div>
  ),
});

export const DailyForecastChart = dynamic(() => import("@/components/DailyForecastChart").then((m) => m.DailyForecastChart), {
  ssr: false,
  loading: () => (
    <div>
      <Box className="mb-2 h-[72px]" />
      <Box className="aspect-video w-full" />
    </div>
  ),
});

export const GenderDonut = dynamic(() => import("@/components/GenderDonut").then((m) => m.GenderDonut), {
  ssr: false,
  loading: () => <Box className="h-28 w-56" />,
});
