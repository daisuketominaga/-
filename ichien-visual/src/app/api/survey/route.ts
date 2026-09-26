import { NextRequest, NextResponse } from "next/server";
import { readSurvey } from "@/lib/surveyRead";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { image, hint } = (await req.json()) as { image: string; hint?: string };
  if (!image?.startsWith("data:")) return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  const [meta, b64] = image.split(",");
  const mediaType = (meta.match(/data:(.*?);/)?.[1] || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  try {
    const r = await readSurvey({ b64, mediaType }, hint);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
