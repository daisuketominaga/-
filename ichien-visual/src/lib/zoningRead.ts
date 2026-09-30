import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SYSTEM = `あなたは日本の都市計画・建築規制の専門家です。渡される画像は、自治体の都市計画情報Web地図（横浜市 i-マッピー、東京都 都市計画情報等）や
用途地域図の画面で、ある地点の「都市計画の内容」が表示されています。書かれている内容だけを読み取り、JSON だけを返します。
推測で埋めてはいけません。画像に無い項目は null にします。

返す JSON:
{
  "zone": "第一種低層住居専用地域" など用途地域の正式名称（無ければ null）,
  "coverage": 建ぺい率 %（数値）,
  "far": 容積率 %（数値）,
  "kodo": "第1種高度地区" など（無ければ null）,
  "kodoCity": "横浜市" など自治体名（分かれば）,
  "shadow": { "target": "10m超" | "軒高7m超・3階以上" | null, "plane": 1.5 | 4 | 6.5 | null, "hours5": 数値 | null, "hours10": 数値 | null } または null,
  "fire": "防火地域" | "準防火地域" | "22条区域" | "指定なし" | null,
  "minSite": 最低敷地面積 ㎡（数値）または null,
  "absoluteHeight": 高さの最高限度 m（数値）または null,
  "others": ["緑化地域", "宅地造成工事規制区域", "地区計画 ○○", ...] 画像に見える他の規制の名称,
  "address": 表示されている住所・地点名（あれば）,
  "notes": "読み取りで迷った点"
}`;

export type ZoningResult = {
  zone: string | null;
  coverage: number | null;
  far: number | null;
  kodo: string | null;
  kodoCity: string | null;
  shadow: { target: string | null; plane: number | null; hours5: number | null; hours10: number | null } | null;
  fire: string | null;
  minSite: number | null;
  absoluteHeight: number | null;
  others: string[];
  address: string | null;
  notes: string;
};

export async function readZoning(image: { b64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }): Promise<ZoningResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.b64 } }, { type: "text", text: "この画面の都市計画の内容を読み取って JSON で返してください。" }] }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    throw new Error(`JSONとして読めませんでした: ${text.slice(0, 200)}`);
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const sh = j.shadow && typeof j.shadow === "object" ? (j.shadow as Record<string, unknown>) : null;
  return {
    zone: str(j.zone),
    coverage: num(j.coverage),
    far: num(j.far),
    kodo: str(j.kodo),
    kodoCity: str(j.kodoCity),
    shadow: sh ? { target: str(sh.target), plane: num(sh.plane), hours5: num(sh.hours5), hours10: num(sh.hours10) } : null,
    fire: str(j.fire),
    minSite: num(j.minSite),
    absoluteHeight: num(j.absoluteHeight),
    others: Array.isArray(j.others) ? (j.others as unknown[]).map(String) : [],
    address: str(j.address),
    notes: typeof j.notes === "string" ? j.notes : "",
  };
}
