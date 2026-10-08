import { NextResponse } from "next/server";
import { getAllCrowd } from "@/lib/crowd/service";

export async function GET() {
  return NextResponse.json(await getAllCrowd());
}
