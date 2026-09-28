import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SYSTEM = `あなたは日本の木造住宅の間取りを設計する建築プランナーです。
入力の JSON（建物外形と各階の部屋）を、指示に従って書き換え、JSON だけを返します。説明文は書かず、JSON 以外を出力しないでください。

座標のルール:
- 【単位はマス】1マス = 910mm。建物外形（幅 w、奥行 d）も部屋の x, y, w, d も、すべて「マス数」で書く（メートルではない）。建物外形の左下が原点。x は右へ、y は奥へ。
- 各部屋は矩形 {id, name, type, x, y, w, d}。必ず 0 ≤ x, x+w ≤ 建物幅（マス）、0 ≤ y, y+d ≤ 建物奥行（マス）。
- 【910mm モジュール厳守】x, y, w, d は原則 整数（マス数）。0.5（半マス）を使ってよいのは type が hall（廊下・ホール）, toilet, washroom, closet, storage, stairs, entrance の部屋だけ。ldk, living, kitchen, bedroom, japanese, study, bath, garage, balcony, other の x, y, w, d は必ず整数。
- 幅や奥行が奇数マス（例: 7）のときは 3+4 のように整数で分ける。3.5+3.5 のように半分にしない。
- 部屋同士は重ならないこと。建物内に隙間が残らないよう、廊下や収納で埋める。入力に "notches"（切り欠き＝建物の外の角）があれば、その範囲には部屋を置かない。
- 階段は全階で同じ位置・同じ大きさにする（type: "stairs"）。直階段は 1×3 マス、回り階段は 2×2 マス。階段には "dir" を必ず付ける（上っていく向き: "up"=奥へ, "down"=底辺(道路)側へ, "left", "right"）。"stairKind" は "straight" / "u_turn" / "l_turn"。既存の stairKind と turn は変えない。段の長手方向と dir を一致させる（dir が up/down なら d > w、left/right なら w > d）。
- バルコニーは type "balcony" で建物外形の中に置く（床面積には含めない）。
- 道路側の面は入力の "roadFace" で示す（"S"=底辺 y=0 側、"N"=奥 y=d 側、"W"=左 x=0 側、"E"=右 x=w 側）。玄関 entrance は道路側の面に接するように置く。玄関 2×1.5 マス以上、玄関ホール 2×2 マス程度。廊下は type hall（other にしない）で幅 1 マス。
- 駐車 "parking" の指定: "builtin1" ならビルトインガレージ（type garage）を 1 階の道路側に 3×6 マス以上（車の出入口が道路側の面に接する向き、道路と直角方向に 6 マス以上）で置く。"builtin2" なら 2 台分 6×6 マス以上。"outdoor" は建物の外に駐車するので建物内にはガレージを置かない。"none" は駐車なし。
- 水回りの標準寸法: 浴室はユニットバス 1616 → 部屋 2×2 マス（bathSize:"1616"）。狭い場合は 1216 → 1.5×2 マス（bathSize:"1216"）。洗面・脱衣室は 2×2 マス（洗面台 1650mm、vanity:1650）か 2×1.5 マス（洗面台 750mm、vanity:750）。浴室と洗面は必ず隣接させ、トイレも近くに。
- 玄関の隣にはホール（type hall）を置き、階段は玄関ホールから上がれる位置に。LDK は道路の反対側か2階の日当たりの良い側へ。LDK は 16 帖（約 32 マス）以上を目標。
- 部屋の広さの目安: トイレ 1×1.5 マス、廊下幅 1 マス、洋室 6 帖（3×4 マス）以上、主寝室 8 帖（4×4 マス）。
- 各階、建物外形（切り欠きを除く）を部屋で隙間なく埋める。同じ部屋を 2 つの矩形に分けてよい（L 字の LDK など。同じ name でよい）。
- 入力に "fixed"（固定する部屋の id 一覧）があれば、その部屋は位置・大きさ・名前・向き（dir, stairKind, turn）を一切変えずにそのまま残し、残りを設計する。
- type は次から選ぶ: ldk, living, kitchen, bedroom, japanese, study, entrance, hall, toilet, bath, washroom, closet, storage, stairs, garage, balcony, other。
- name は日本語（LDK、洋室、和室、玄関、ホール、廊下、トイレ、浴室、洗面・脱衣室、WCL、収納、パントリー、ガレージ、バルコニー、スタディ など）。
- id は既存があれば維持し、新しい部屋は短いランダム文字列。
- 指示で触れていない階は変えない。

返す形:
{"floors":[{"level":1,"rooms":[...]}, ...], "notes":"変更点の短い説明（日本語、1〜2文）"}`;


export type PlanRequest = { mode: "edit" | "generate"; instruction: string; project: unknown; level: number; fixed?: string[]; options?: { parking?: string; roadFace?: string; roadClearance?: number | null } };

const U = 0.91;
type PRoom = { id: string; name: string; type: string; x: number; y: number; w: number; d: number; dir?: string; stairKind?: string; turn?: string; vanity?: number; bathSize?: string };
type PFloor = { level: number; rooms: PRoom[] };
type PBuilding = { w: number; d: number; notches?: { corner: string; w: number; d: number }[] };

const toCells = (v: number) => +(v / U).toFixed(2);
const inNotch = (b: PBuilding, x: number, y: number) =>
  (b.notches ?? []).some((n) => {
    const x0 = n.corner.endsWith("W") ? 0 : b.w - n.w;
    const y0 = n.corner.startsWith("S") ? 0 : b.d - n.d;
    return x > x0 + 1e-6 && x < x0 + n.w - 1e-6 && y > y0 + 1e-6 && y < y0 + n.d - 1e-6;
  });

/** 生成した間取りを機械的に検査する（メートル単位）。空なら合格 */
export function validatePlan(b: PBuilding, floors: PFloor[], roadFace: string, parking: string): string[] {
  const isMod = (v: number) => Math.abs(v / U - Math.round(v / U)) < 1e-3;
  const halfOk = (r: PRoom) => ["hall", "toilet", "washroom", "closet", "storage", "stairs", "entrance"].includes(r.type);
  const issues: string[] = [];
  const overlaps = (a: PRoom, c: PRoom) => a.x + a.w > c.x + 1e-6 && c.x + c.w > a.x + 1e-6 && a.y + a.d > c.y + 1e-6 && c.y + c.d > a.y + 1e-6;
  for (const f of floors) {
    for (const r of f.rooms) {
      if (![r.x, r.y, r.w, r.d].every(isMod) && !halfOk(r)) issues.push(`${f.level}F ${r.name}(${r.id}): 1マス(910mm)の倍数でない (x=${toCells(r.x)},y=${toCells(r.y)},w=${toCells(r.w)},d=${toCells(r.d)} マス)`);
      if (r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > b.w + 1e-6 || r.y + r.d > b.d + 1e-6) issues.push(`${f.level}F ${r.name}(${r.id}): 建物からはみ出している`);
      if (inNotch(b, r.x + r.w / 2, r.y + r.d / 2) || inNotch(b, r.x + 0.01, r.y + 0.01) || inNotch(b, r.x + r.w - 0.01, r.y + r.d - 0.01) || inNotch(b, r.x + 0.01, r.y + r.d - 0.01) || inNotch(b, r.x + r.w - 0.01, r.y + 0.01)) issues.push(`${f.level}F ${r.name}(${r.id}): 切り欠き（建物の外）にかかっている`);
      if (r.type === "bath" && !(r.w >= 1.36 && r.d >= 1.36)) issues.push(`${f.level}F 浴室(${r.id})が小さい ${toCells(r.w)}×${toCells(r.d)} マス`);
      if (r.type === "stairs") {
        const long = r.dir === "up" || r.dir === "down" ? r.d >= r.w : r.w >= r.d;
        if (!long) issues.push(`${f.level}F 階段(${r.id}): dir(${r.dir}) と長手方向が合っていない`);
      }
    }
    for (let i = 0; i < f.rooms.length; i++) for (let j = i + 1; j < f.rooms.length; j++) if (f.rooms[i].type !== "balcony" && f.rooms[j].type !== "balcony" && overlaps(f.rooms[i], f.rooms[j])) issues.push(`${f.level}F ${f.rooms[i].name}(${f.rooms[i].id}) と ${f.rooms[j].name}(${f.rooms[j].id}) が重なっている`);
    const covered = f.rooms.filter((r) => r.type !== "balcony").reduce((s, r) => s + r.w * r.d, 0);
    const fpArea = b.w * b.d - (b.notches ?? []).reduce((s, n) => s + n.w * n.d, 0);
    if (covered < fpArea - 0.5) issues.push(`${f.level}F に隙間が ${(fpArea - covered).toFixed(2)}㎡（約 ${toCells(toCells(fpArea - covered))} マス）残っている。廊下や収納で埋める`);
  }
  const f1 = floors.find((f) => f.level === 1);
  const touches = (r: PRoom) => (roadFace === "S" ? r.y < 1e-6 : roadFace === "N" ? r.y + r.d > b.d - 1e-6 : roadFace === "W" ? r.x < 1e-6 : r.x + r.w > b.w - 1e-6);
  if (f1) {
    const ent = f1.rooms.find((r) => r.type === "entrance");
    if (!ent) issues.push("1F に玄関(entrance)が無い");
    else if (!touches(ent)) issues.push(`玄関(${ent.id})が道路側の面(${roadFace})に接していない`);
    const gar = f1.rooms.find((r) => r.type === "garage");
    if (parking.startsWith("builtin")) {
      if (!gar) issues.push("ビルトインガレージ(garage)が 1F に無い");
      else if (!touches(gar)) issues.push(`ガレージ(${gar.id})が道路側の面(${roadFace})に接していない`);
      else if ((roadFace === "S" || roadFace === "N" ? gar.d : gar.w) < 5.4) issues.push(`ガレージ(${gar.id})の道路と直角方向の長さが 6 マス未満`);
    } else if (gar) issues.push(`駐車が ${parking} なのに建物内にガレージ(${gar.id})がある`);
    // 階段は全階で同じ位置
    const st1 = f1.rooms.find((r) => r.type === "stairs");
    for (const f of floors) {
      if (f.level === 1) continue;
      const st = f.rooms.find((r) => r.type === "stairs");
      if (st1 && st && (Math.abs(st.x - st1.x) > 1e-6 || Math.abs(st.y - st1.y) > 1e-6 || Math.abs(st.w - st1.w) > 1e-6 || Math.abs(st.d - st1.d) > 1e-6)) issues.push(`${f.level}F の階段(${st.id})が 1F の階段と位置・大きさが違う`);
      if (st1 && !st && f.level < floors.length) issues.push(`${f.level}F に階段が無い`);
    }
  }
  return issues;
}

/** 間取りの生成・編集。API ルートと自己テストの両方から呼ぶ（内部 HTTP を介さない） */
export async function generatePlan(body: PlanRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  const { mode, instruction, project, level, fixed, options } = body;
  const parking = options?.parking ?? "none";
  const roadFace = options?.roadFace ?? "S";
  const parkingText = parking === "builtin1" ? "ビルトインガレージ 1 台を道路側に。" : parking === "builtin2" ? "ビルトインガレージ 2 台を道路側に。" : parking === "outdoor" ? `屋外駐車（建物の外、道路側の空き ${options?.roadClearance != null ? options.roadClearance.toFixed(2) + "m" : "不明"}）なのでガレージは建物内に置かない。` : "駐車なし。";
  const proj = project as { building: PBuilding & { floors?: number }; floors?: PFloor[]; site?: unknown };
  const b = proj.building;
  const floorsN = b.floors ?? 2;
  const defaultReq = floorsN >= 3 ? "1階に玄関・水回り（浴室1616・洗面・トイレ）・個室またはガレージ、2階にLDK（16帖以上）とトイレ、3階に個室2〜3室とバルコニー" : "1階に玄関・LDK・水回り（浴室1616・洗面・トイレ）、2階に個室3室・トイレ・バルコニー";

  // モデルには「マス」単位で渡す（910mm モジュールを守りやすくするため）
  const cellsInput = {
    building: { ...b, w: toCells(b.w), d: toCells(b.d), notches: (b.notches ?? []).map((n) => ({ ...n, w: toCells(n.w), d: toCells(n.d) })) },
    floors: (proj.floors ?? []).map((f) => ({ ...f, rooms: (f.rooms ?? []).map((r) => ({ ...r, x: toCells(r.x), y: toCells(r.y), w: toCells(r.w), d: toCells(r.d) })) })),
    site: proj.site,
    fixed: fixed ?? [],
    roadFace,
    parking,
  };
  const user =
    mode === "generate"
      ? `次の建物外形に対して、全階の間取りを提案してください。今見ている階は ${level} 階です。道路側の面: ${roadFace}。駐車: ${parkingText}${fixed && fixed.length ? `固定する部屋の id（動かさない）: ${fixed.join(", ")}。` : "固定する部屋はありません。"}要望: ${instruction || defaultReq}。座標はすべてマス（1マス=910mm）で、910mm モジュールを厳守してください。\n\n入力（マス単位）:\n${JSON.stringify(cellsInput)}`
      : `次の間取りを、指示に従って直してください。今見ている階は ${level} 階です。座標はすべてマス（1マス=910mm）です。\n指示: ${instruction}\n\n入力（マス単位）:\n${JSON.stringify(cellsInput)}`;

  const client = new Anthropic({ apiKey });
  // 生成は 1 分近くかかるのでストリーミングで受ける。思考（thinking）に出力枠を使い切って本文が空にならないよう、
  // 思考は浅め（effort: low）にし、それでも本文が空なら思考なしでもう一度だけ試す。
  const ask = (messages: Anthropic.MessageParam[], thinking: "low" | "off") =>
    client.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages,
        ...(thinking === "off" ? { thinking: { type: "disabled" as const } } : { thinking: { type: "adaptive" as const }, output_config: { effort: "low" as const } }),
      })
      .finalMessage();
  const call = async (messages: Anthropic.MessageParam[], thinking: "low" | "off" = "low") => {
    const t0 = Date.now();
    let msg = await ask(messages, thinking);
    let text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    if (!text.trim() && msg.stop_reason === "max_tokens") {
      msg = await ask(messages, "off");
      text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    }
    let json: { floors?: unknown; notes?: string };
    try {
      json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch {
      throw new Error(`間取りのJSONが読めませんでした（stop=${msg.stop_reason}, 文字数=${text.length}）: ${text.slice(0, 200)}`);
    }
    if (!Array.isArray(json.floors)) throw new Error("間取りの形式が読めませんでした");
    console.log("plan call", thinking, Date.now() - t0, "ms", "out", msg.usage.output_tokens, "stop", msg.stop_reason);
    return { json, text, usage: msg.usage };
  };

  // マス → メートルに戻し、建物外形に収める安全処理
  const toMeters = (json: { floors?: unknown }): PFloor[] =>
    (json.floors as { level: number; rooms: Array<Record<string, unknown>> }[]).map((f) => ({
      level: Number(f.level),
      rooms: (f.rooms || []).map((r) => {
        const snap = (v: number) => Math.round(v * 2) / 2 * U; // 半マス単位に丸めてメートルへ
        const x = Math.max(0, Math.min(b.w, snap(Number(r.x) || 0)));
        const y = Math.max(0, Math.min(b.d, snap(Number(r.y) || 0)));
        const w = Math.max(U / 2, Math.min(b.w - x, snap(Number(r.w) || 1)));
        const d = Math.max(U / 2, Math.min(b.d - y, snap(Number(r.d) || 1)));
        const dir = ["up", "down", "left", "right"].includes(String(r.dir)) ? String(r.dir) : undefined;
        const room: PRoom = {
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
        return room;
      }),
    }));

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let r = await call(messages);
  let floors = toMeters(r.json);
  let issues = validatePlan(b, floors, roadFace, parking);
  let usage = r.usage;
  let repaired = false;
  // 機械検査で引っかかったら、その指摘を渡して 1 回だけ直させる
  if (issues.length && mode === "generate") {
    const fixMsg: Anthropic.MessageParam[] = [
      ...messages,
      { role: "assistant", content: r.text },
      { role: "user", content: `上の間取りを機械的に検査したところ、次の問題がありました。すべて直した完全な JSON（全階）をもう一度返してください。座標はマス単位のままです。\n- ${issues.join("\n- ")}` },
    ];
    try {
      const r2 = await call(fixMsg, "off"); // 直しは考えずに速く
      const floors2 = toMeters(r2.json);
      const issues2 = validatePlan(b, floors2, roadFace, parking);
      if (issues2.length <= issues.length) {
        r = r2;
        floors = floors2;
        issues = issues2;
        repaired = true;
      }
      usage = { ...usage, input_tokens: usage.input_tokens + r2.usage.input_tokens, output_tokens: usage.output_tokens + r2.usage.output_tokens } as typeof usage;
    } catch (e) {
      console.warn("plan repair failed", (e as Error).message);
    }
  }
  return { floors, notes: r.json.notes, issues, repaired, usage };
}
