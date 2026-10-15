import { CrowdMap } from "@/components/CrowdMap";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

export default async function MapPage() {
  const crowd = await getAllCrowd();
  return (
    <main className="pt-5 md:pt-8">
      <div className="px-5 md:px-0">
        <h1 className="text-2xl font-bold md:text-3xl">혼잡도 지도</h1>
        <p className="mt-0.5 text-sm text-gray-500">원이 크고 붉을수록 붐벼요. 위 색깔표로 단계를 확인하고, 핀을 누르면 자세히 볼 수 있어요.</p>
      </div>
      <div className="mt-3 md:mt-5 md:overflow-hidden md:rounded-3xl">
        <CrowdMap places={PLACES} crowd={crowd} />
      </div>
    </main>
  );
}
