import { NextRequest, NextResponse } from "next/server";
import { readSurvey } from "@/lib/surveyRead";

// 測量図＋販売図面の2枚読みは 60 秒を超えることがあるので長めに（Vercel の上限内）
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { image?: string; images?: string[]; hint?: string };
  const list = (Array.isArray(body.images) && body.images.length ? body.images : body.image ? [body.image] : []).filter((s) => typeof s === "string" && s.startsWith("data:")).slice(0, 4);
  if (list.length === 0) return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  const images = list.map((img) => {
    const [meta, b64] = img.split(",");
    const mediaType = (meta.match(/data:(.*?);/)?.[1] || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    return { b64, mediaType };
  });
  try {
    const r = await readSurvey(images, body.hint);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
