import { NextResponse } from "next/server";
import { CDN_CACHE_HEADERS } from "@/lib/cdn";
import { getAllCrowd } from "@/lib/crowd/service";

export async function GET() {
  return NextResponse.json(await getAllCrowd(), { headers: CDN_CACHE_HEADERS });
}
