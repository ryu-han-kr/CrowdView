import type { Place } from "@/lib/types";
import { DataTag } from "./DataTag";

/** 행사 날짜의 출처 표시: TourAPI 올해 일정이면 없음, 작년 일정 기준이면 (추정), 직접 넣은 값이면 (임의) */
export function EventDateTag({ place }: { place: Place }) {
  if (!place.ktoContent) return <DataTag kind="임의" />;
  if (place.info?.eventVerified === false) return <DataTag />;
  return null;
}
