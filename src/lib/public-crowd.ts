// AI 검색·에이전트용 공개 요약: 지금 혼잡도 (llms.txt, /api/public/crowd 가 함께 쓴다)
import { getT } from "@/i18n/server";
import { getAllCrowd } from "./crowd/service";
import { levelOf } from "./levels";
import { PLACES, placeHref } from "./places";
import { SEOUL_AREAS } from "./seoul-areas";
import { getAllSeoulLive } from "./seoul-live";
import { SITE } from "./seo";

export interface PublicCrowd {
  updatedAt: string;
  places: { name: string; nameEn: string; url: string; level: string; levelEn: string; score: number; open: boolean }[];
  seoul: { name: string; nameEn: string; url: string; level: string; peopleMin: number; peopleMax: number; time: string }[];
}

const en = getT("en");

export async function getPublicCrowd(): Promise<PublicCrowd> {
  const [crowd, seoul] = await Promise.all([getAllCrowd(), getAllSeoulLive()]);
  return {
    updatedAt: new Date().toISOString(),
    places: PLACES.filter((p) => crowd[p.id]).map((p) => {
      const c = crowd[p.id];
      const lv = levelOf(c.score);
      return { name: p.name, nameEn: en(p.name), url: `${SITE}${placeHref(p)}`, level: lv.label, levelEn: en(lv.label), score: c.score, open: c.open };
    }),
    seoul: SEOUL_AREAS.filter((a) => seoul[a.code]).map((a) => {
      const s = seoul[a.code];
      return { name: a.name, nameEn: a.name, url: `${SITE}/seoul/${a.code}`, level: s.level, peopleMin: s.min, peopleMax: s.max, time: s.time };
    }),
  };
}
