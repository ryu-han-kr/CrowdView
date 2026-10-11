import { CrowdMap } from "@/components/CrowdMap";
import { LevelLegend } from "@/components/Level";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const crowd = await getAllCrowd();
  return (
    <main className="pt-6">
      <div className="px-5">
        <h1 className="text-2xl font-bold">혼잡도 지도</h1>
        <p className="mt-1 text-sm text-gray-500">원이 크고 붉을수록 붐벼요. 핀을 눌러 자세히 보세요.</p>
      </div>
      <div className="mt-4">
        <CrowdMap places={PLACES} crowd={crowd} />
      </div>
      <div className="px-5 pt-4">
        <LevelLegend />
      </div>
    </main>
  );
}
