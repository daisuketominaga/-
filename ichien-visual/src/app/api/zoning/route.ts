import { NextRequest, NextResponse } from "next/server";
import { readZoning } from "@/lib/zoningRead";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { image } = (await req.json()) as { image: string };
  if (!image?.startsWith("data:")) return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  const [meta, b64] = image.split(",");
  const mediaType = (meta.match(/data:(.*?);/)?.[1] || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  try {
    return NextResponse.json(await readZoning({ b64, mediaType }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
