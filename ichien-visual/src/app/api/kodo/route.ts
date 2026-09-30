import { NextRequest, NextResponse } from "next/server";
import { readKodo } from "@/lib/kodoRead";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { image, kind, city } = (await req.json()) as { image: string; kind: string; city?: string };
  if (!image?.startsWith("data:")) return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "種別（例: 第4種高度地区）を入れてください" }, { status: 400 });
  const [meta, b64] = image.split(",");
  const mediaType = (meta.match(/data:(.*?);/)?.[1] || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  try {
    return NextResponse.json(await readKodo({ b64, mediaType }, kind, city));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
