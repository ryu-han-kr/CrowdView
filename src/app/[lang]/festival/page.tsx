import { redirect } from "next/navigation";
import { localePath, type Lang } from "@/i18n/config";

// /festival (목록 주소를 짐작해 들어온 경우) → 전국 축제 목록 /events
export default async function FestivalIndex({ params }: { params: Promise<{ lang: string }> }) {
  redirect(localePath((await params).lang as Lang, "/events"));
}
