import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SYSTEM = `あなたは日本の木造住宅の間取りを設計する建築プランナーです。
入力の JSON（建物外形と各階の部屋）を、指示に従って書き換え、JSON だけを返します。説明文は書かず、JSON 以外を出力しないでください。

座標のルール:
- 単位はメートル。建物外形（幅 w = 東西、奥行 d = 南北）の左下（南西）が原点。x は東へ、y は北へ。
- 各部屋は矩形 {id, name, type, x, y, w, d}。必ず 0 ≤ x, x+w ≤ 建物幅、0 ≤ y, y+d ≤ 建物奥行。
- x, y, w, d はすべて 0.455 の倍数（尺モジュール。1マス=0.91m、半マス=0.455m）にする。
- 部屋同士は重ならないこと。建物内に隙間が残らないよう、廊下や収納で埋める。
- 階段は全階で同じ位置・同じ大きさにする（type: "stairs"、0.91×2.73m 程度）。階段には "dir" を必ず付ける（上っていく向き: "up"=奥へ, "down"=底辺(道路)側へ, "left", "right"）。段の長手方向と dir を一致させる（dir が up/down なら d > w、left/right なら w > d）。
- バルコニーは type "balcony" で建物外形の中に置く（床面積には含めない）。
- 玄関 entrance は道路側（ヒントがなければ西面 x=0 側）に置く。
- 部屋の広さの目安: トイレ 1.0×1.0、浴室 1.6×1.6〜1.8×1.8、洗面 1.6×1.6、廊下幅 0.9〜1.0。
- type は次から選ぶ: ldk, living, kitchen, bedroom, japanese, study, entrance, hall, toilet, bath, washroom, closet, storage, stairs, garage, balcony, other。
- name は日本語（LDK、洋室、和室、玄関、廊下、トイレ、浴室、洗面・脱衣室、WCL、収納、パントリー、ガレージ、バルコニー、スタディ など）。
- id は既存があれば維持し、新しい部屋は短いランダム文字列。
- 指示で触れていない階は変えない。

返す形:
{"floors":[{"level":1,"rooms":[...]}, ...], "notes":"変更点の短い説明（日本語、1〜2文）"}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  const body = await req.json();
  const { mode, instruction, project, level } = body as { mode: "edit" | "generate"; instruction: string; project: unknown; level: number };

  const user =
    mode === "generate"
      ? `次の建物外形に対して、全階の間取りをゼロから提案してください。今見ている階は ${level} 階です。要望: ${instruction || "1階に玄関・水回り・ガレージまたは個室、2階にLDK、3階に個室、というよくある3階建ての構成"}\n\n入力:\n${JSON.stringify(project)}`
      : `次の間取りを、指示に従って直してください。今見ている階は ${level} 階です。\n指示: ${instruction}\n\n入力:\n${JSON.stringify(project)}`;

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (!Array.isArray(json.floors)) throw new Error("間取りの形式が読めませんでした");
    // 建物外形に収める安全処理
    const b = (project as { building: { w: number; d: number } }).building;
    const floors = json.floors.map((f: { level: number; rooms: Array<Record<string, unknown>> }) => ({
      level: Number(f.level),
      rooms: (f.rooms || []).map((r) => {
        const snap = (v: number) => Math.round(v / 0.455) * 0.455;
        const x = Math.max(0, Math.min(b.w, snap(Number(r.x) || 0)));
        const y = Math.max(0, Math.min(b.d, snap(Number(r.y) || 0)));
        const w = Math.max(0.455, Math.min(b.w - x, snap(Number(r.w) || 0.91)));
        const d = Math.max(0.455, Math.min(b.d - y, snap(Number(r.d) || 0.91)));
        const dir = ["up", "down", "left", "right"].includes(String(r.dir)) ? String(r.dir) : undefined;
        return {
          id: String(r.id || Math.random().toString(36).slice(2, 9)),
          name: String(r.name || "部屋"),
          type: String(r.type || "other"),
          ...(String(r.type) === "stairs" ? { dir: dir ?? "up" } : {}),
          x: +x.toFixed(3),
          y: +y.toFixed(3),
          w: +w.toFixed(3),
          d: +d.toFixed(3),
        };
      }),
    }));
    return NextResponse.json({ floors, notes: json.notes, usage: msg.usage });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
