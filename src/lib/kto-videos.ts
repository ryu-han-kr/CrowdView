// 장소·명소의 관광공사 드론 영상 (scripts/korea-data/kto-videos.mts 로 만든 JSON). 없으면 []
import type { DroneVideo } from "@/components/DroneVideos";
import data from "@/data/korea/kto-videos.json";

export const videosFor = (id: string): DroneVideo[] => (data as Record<string, DroneVideo[]>)[id] ?? [];
