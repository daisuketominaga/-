import Anthropic from "@anthropic-ai/sdk";
import type { SlopeSeg } from "./heightPresets";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SYSTEM = `あなたは日本の都市計画・建築基準法の専門家です。渡される画像は、自治体の「高度地区」の制限内容
（都市計画図の凡例、建築基準法取扱基準集、都市計画決定の告示、不動産会社の重要事項説明の資料など）です。
指定された種別（例: 第4種高度地区）の制限を読み取り、JSON だけを返します。説明文は不要です。

読み取るもの:
1. 北側斜線: 「真北方向の水平距離 L に対する高さの上限」を区間ごとの1次式で表す。
   例: 「5m + 0.6 × L」→ {from:0, upTo:null, base:5, slope:0.6}
   例: 「L≦8m: 5m+0.6L、L>8m: 9.8m+1.25(L−8)」→ [{from:0,upTo:8,base:5,slope:0.6},{from:8,upTo:null,base:9.8,slope:1.25}]
   図（断面図）で「1:0.6」「1/1.25」のように勾配が書かれている場合、水平1に対する高さの比に直す（0.6 や 1.25）。
   「立ち上がり」「起点」の高さが base。
2. 絶対高さ（最高限度）: 「○m以下」「高さの最高限度 ○m」など。無ければ 0。
3. 適用除外・緩和（北側が道路・水面のときの扱い、隣地との高低差、既存不適格など）は notes に要約。

返す JSON:
{
  "kind": "第4種高度地区",
  "city": "横浜市",
  "segs": [{"from":0,"upTo":null,"base":5,"slope":0.6}],
  "absoluteMax": 20,
  "northLineNone": false,
  "confidence": "high" | "medium" | "low",
  "quote": "根拠になった原文の文言をそのまま（短く）",
  "notes": "適用除外・緩和・読み取りで迷った点"
}
指定された種別の記載が画像に無い場合は segs を空、absoluteMax を 0、confidence を "low" にし、notes にその旨を書く。数値を推測で埋めてはいけない。`;

export type KodoReadResult = { kind: string; city: string; segs: SlopeSeg[]; absoluteMax: number; northLineNone: boolean; confidence: string; quote: string; notes: string; usage: unknown };

export async function readKodo(image: { b64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }, kind: string, city?: string): Promise<KodoReadResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.b64 } }, { type: "text", text: `${city ? city + "の" : ""}「${kind}」の制限内容を読み取って JSON で返してください。` }] }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    throw new Error(`JSONとして読めませんでした（stop=${msg.stop_reason}）: ${text.slice(0, 300)}`);
  }
  const segs = Array.isArray(json.segs) ? (json.segs as SlopeSeg[]).filter((s) => typeof s.base === "number" && typeof s.slope === "number").map((s) => ({ from: Number(s.from ?? 0), upTo: s.upTo === null || s.upTo === undefined ? null : Number(s.upTo), base: Number(s.base), slope: Number(s.slope) })) : [];
  return {
    kind: String(json.kind ?? kind),
    city: String(json.city ?? city ?? ""),
    segs,
    absoluteMax: typeof json.absoluteMax === "number" ? json.absoluteMax : 0,
    northLineNone: !!json.northLineNone,
    confidence: String(json.confidence ?? "low"),
    quote: String(json.quote ?? ""),
    notes: String(json.notes ?? ""),
    usage: msg.usage,
  };
}
