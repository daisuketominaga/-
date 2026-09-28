import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SYSTEM = `あなたは日本の木造住宅の間取りを設計する建築プランナーです。
入力の JSON（建物外形と各階の部屋）を、指示に従って書き換え、JSON だけを返します。説明文は書かず、JSON 以外を出力しないでください。

座標のルール:
- 単位はメートル。建物外形（幅 w、奥行 d）の左下が原点。x は右へ、y は奥へ。
- 各部屋は矩形 {id, name, type, x, y, w, d}。必ず 0 ≤ x, x+w ≤ 建物幅、0 ≤ y, y+d ≤ 建物奥行。
- 【910mm モジュール厳守】x, y, w, d は原則 0.91 の倍数にする（1マス=0.91m）。半マス 0.455 を使ってよいのは、廊下の幅（0.91 固定）、トイレ（0.91×1.365 または 0.91×1.82）、洗面・脱衣室の奥行（1.365）、収納の奥行（0.455 / 0.91）だけ。それ以外の部屋の x, y, w, d に 0.455 の端数を作らない。
- 部屋同士は重ならないこと。建物内に隙間が残らないよう、廊下や収納で埋める。入力に "notches"（切り欠き＝建物の外の角）があれば、その範囲には部屋を置かない。
- 階段は全階で同じ位置・同じ大きさにする（type: "stairs"）。直階段は 0.91×2.73、回り階段は 1.82×1.82。階段には "dir" を必ず付ける（上っていく向き: "up"=奥へ, "down"=底辺(道路)側へ, "left", "right"）。"stairKind" は "straight" / "u_turn" / "l_turn"。既存の stairKind と turn は変えない。段の長手方向と dir を一致させる（dir が up/down なら d > w、left/right なら w > d）。
- バルコニーは type "balcony" で建物外形の中に置く（床面積には含めない）。
- 道路側の面は入力の "roadFace" で示す（"S"=底辺 y=0 側、"N"=奥 y=d 側、"W"=左 x=0 側、"E"=右 x=w 側）。玄関 entrance は道路側の面に接するように置く。玄関 1.82×1.365 以上、玄関ホール 1.82×1.82 程度。
- 駐車 "parking" の指定: "builtin1" ならビルトインガレージ（type garage）を 1 階の道路側に 2.73×5.46 以上（車の出入口が道路側の面に接する向き、奥行 5.46 以上）で置く。"builtin2" なら 2 台分 5.46×5.46 以上。"outdoor" は建物の外に駐車するので建物内にはガレージを置かない。"none" は駐車なし。
- 水回りの標準寸法: 浴室はユニットバス 1616 → 部屋 1.82×1.82（bathSize:"1616"）。狭い場合は 1216 → 1.365×1.82（bathSize:"1216"）。洗面・脱衣室は 1.82×1.82（洗面台 1650mm、vanity:1650）か 1.82×1.365（洗面台 750mm、vanity:750）。浴室と洗面は必ず隣接させ、トイレも近くに。
- 玄関の隣にはホール（type hall）を置き、階段は玄関ホールから上がれる位置に。LDK は道路の反対側か2階の日当たりの良い側へ。LDK は 16 帖（約 26㎡）以上を目標。
- 部屋の広さの目安: トイレ 0.91×1.365、廊下幅 0.91、洋室 6 帖（2.73×3.64）以上、主寝室 8 帖（3.64×3.64）。
- 入力に "fixed"（固定する部屋の id 一覧）があれば、その部屋は位置・大きさ・名前・向き（dir, stairKind, turn）を一切変えずにそのまま残し、残りを設計する。
- type は次から選ぶ: ldk, living, kitchen, bedroom, japanese, study, entrance, hall, toilet, bath, washroom, closet, storage, stairs, garage, balcony, other。
- name は日本語（LDK、洋室、和室、玄関、ホール、廊下、トイレ、浴室、洗面・脱衣室、WCL、収納、パントリー、ガレージ、バルコニー、スタディ など）。
- id は既存があれば維持し、新しい部屋は短いランダム文字列。
- 指示で触れていない階は変えない。

返す形:
{"floors":[{"level":1,"rooms":[...]}, ...], "notes":"変更点の短い説明（日本語、1〜2文）"}`;


export type PlanRequest = { mode: "edit" | "generate"; instruction: string; project: unknown; level: number; fixed?: string[]; options?: { parking?: string; roadFace?: string; roadClearance?: number | null } };

/** 間取りの生成・編集。API ルートと自己テストの両方から呼ぶ（内部 HTTP を介さない） */
export async function generatePlan(body: PlanRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  const { mode, instruction, project, level, fixed, options } = body;
  const parking = options?.parking ?? "none";
  const parkingText = parking === "builtin1" ? "ビルトインガレージ 1 台を道路側に。" : parking === "builtin2" ? "ビルトインガレージ 2 台を道路側に。" : parking === "outdoor" ? `屋外駐車（建物の外、道路側の空き ${options?.roadClearance != null ? options.roadClearance.toFixed(2) + "m" : "不明"}）なのでガレージは建物内に置かない。` : "駐車なし。";
  const floorsN = (project as { building?: { floors?: number } }).building?.floors ?? 2;
  const defaultReq = floorsN >= 3 ? "1階に玄関・水回り（浴室1616・洗面・トイレ）・個室またはガレージ、2階にLDK（16帖以上）とトイレ、3階に個室2〜3室とバルコニー" : "1階に玄関・LDK・水回り（浴室1616・洗面・トイレ）、2階に個室3室・トイレ・バルコニー";

  const user =
    mode === "generate"
      ? `次の建物外形に対して、全階の間取りを提案してください。今見ている階は ${level} 階です。道路側の面: ${options?.roadFace ?? "S"}。駐車: ${parkingText}${fixed && fixed.length ? `固定する部屋の id（動かさない）: ${fixed.join(", ")}。` : "固定する部屋はありません。"}要望: ${instruction || defaultReq}。910mm モジュールを厳守してください。\n\n入力:\n${JSON.stringify({ ...(project as object), fixed: fixed ?? [], roadFace: options?.roadFace ?? "S", parking })}`
      : `次の間取りを、指示に従って直してください。今見ている階は ${level} 階です。\n指示: ${instruction}\n\n入力:\n${JSON.stringify(project)}`;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content: user }] });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  let json: { floors?: unknown; notes?: string };
  try {
    json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    throw new Error(`間取りのJSONが読めませんでした（stop=${msg.stop_reason}, 文字数=${text.length}）: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(json.floors)) throw new Error("間取りの形式が読めませんでした");
  // 建物外形に収める安全処理
  const b = (project as { building: { w: number; d: number } }).building;
  const floors = (json.floors as { level: number; rooms: Array<Record<string, unknown>> }[]).map((f) => ({
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
        ...(String(r.type) === "stairs" ? { dir: dir ?? "up", stairKind: ["straight", "u_turn", "l_turn"].includes(String(r.stairKind)) ? String(r.stairKind) : "straight", ...(r.turn ? { turn: String(r.turn) === "right" ? "right" : "left" } : {}) } : {}),
        ...(String(r.type) === "washroom" ? { vanity: [600, 750, 900, 1200, 1650].includes(Number(r.vanity)) ? Number(r.vanity) : w >= 1.8 ? 1650 : 750 } : {}),
        ...(String(r.type) === "bath" ? { bathSize: typeof r.bathSize === "string" && /^\d{4}$/.test(r.bathSize) ? r.bathSize : w >= 1.8 && d >= 1.8 ? "1616" : "1216" } : {}),
        x: +x.toFixed(3),
        y: +y.toFixed(3),
        w: +w.toFixed(3),
        d: +d.toFixed(3),
      };
    }),
  }));
  return { floors, notes: json.notes, usage: msg.usage };
}
