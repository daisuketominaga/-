import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SYSTEM = `あなたは日本の不動産測量図（確定測量図・地積測量図・公図・区画図）を読み取る専門家です。
図から敷地の境界点座標を復元し、JSONだけを返します。説明文は不要です。

最優先の読み方（求積表がある場合）:
- 地積測量図には「求積表」があり、各境界点（K1, K2, … または 1, 2, …）の座標 X, Y が載っている。
  日本の公共座標では X が南北方向（北が正）、Y が東西方向（東が正）。この表を最優先で読み取る。
- 辺の長さは座標から √((X差)²+(Y差)²) で計算する。図に書かれた辺長がぼやけていても、座標から確定できる。
- 出力の x には Y（東西）、y には X（南北）を入れる（全体を平行移動して 0 以上にする）。
- 求積表の各点について、読み取った座標を "coords" に {label, X, Y} の配列で必ず返す。
- 図に「使用した座標系」があれば "coordSystem" に書き写す（例: "平面直角座標系 第IX系" / "任意座標系"）。任意座標系のときは座標の向きが真北と一致しないので、必ず "coordSystem" に "任意座標系" と返し、方位記号の傾きがあれば "northHint" に「北矢印が上から時計回りに約○度傾いている」のように書く。

座標系:
- 単位はメートル。x は東が正、y は北が正。
- 求積表の座標を使う場合は座標系がそのまま北基準。求積表が無い場合のみ北矢印を基準に、北が画面上になるように解釈する。
- 原点は敷地のいちばん南西寄りの点付近（すべての座標が 0 以上になるよう平行移動する）。
- 点は敷地の外周を一方向（時計回り）に並べる。隅切りも点として含める。
- 辺の長さが図に書かれている場合、その数字を最優先し、座標はそれと矛盾しないように決める。
- 面積が図に書かれていれば areaOverride に入れる。
- 道路: 図に「道路」「公道」「市道」「私道」「幅員○m」「法42条」などの記載や、道路を表す帯・地番の無い細長い区域が敷地の辺に接していれば、その辺を必ず road:true にし、幅員が読めれば roadWidth（m）、種別が読めれば roadLabel に入れる。道路に接する辺が一つも無い敷地は珍しいので、無い場合は notes にその旨を書く。

返すJSONの形:
{
  "points": [{"x":0.42,"y":9.19}, ...],
  "edges": [
    {"index":0,"length":8.40},
    {"index":4,"length":7.63,"road":true,"roadWidth":4.0,"roadLabel":"法42条1項1号 公道","note":"NTT柱有"}
  ],
  "areaOverride": 79.43,
  "coords": [{"label":"K1","X":109.234,"Y":103.087}, ...],
  "coordSystem": "任意座標系" または "平面直角座標系",
  "northHint": "方位記号の見え方（任意座標系のときだけ）",
  "notes": "読み取りで自信のない箇所を一言。求積表から計算した場合はその旨"
}
edges[i].index は points[i] から points[i+1] への辺。道路に接する辺は road:true。
数字が読めない場合は推測せず、その辺の length を省略する。`;

export type SurveyResult = {
  site: { points: { x: number; y: number }[]; edges: unknown[]; northDeg: number; areaOverride?: number };
  coords: { label: string; X: number; Y: number }[] | null;
  coordSystem: string | null;
  notes: string;
  usage: unknown;
};

/** 測量図の画像（data URL または base64 + mime）を Claude で読み取る */
export async function readSurvey(image: { b64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }, hint?: string): Promise<SurveyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません（Vercelの環境変数に追加してください）");
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.b64 } },
          { type: "text", text: `この測量図を読み取ってJSONで返してください。${hint ? "補足: " + hint : ""}` },
        ],
      },
    ],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  let json: Record<string, unknown>;
  try {
    // ```json フェンスや前置きがあっても、最初の { から最後の } までを取る
    const body = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    json = JSON.parse(body);
  } catch {
    throw new Error(`JSONとして読めませんでした（stop=${msg.stop_reason}, 文字数=${text.length}）: ${text.slice(0, 400)}`);
  }
  const rawPoints = json.points as { x: number; y: number }[] | undefined;
  if (!Array.isArray(rawPoints) || rawPoints.length < 3) throw new Error("境界点が読み取れませんでした");
  const minX = Math.min(...rawPoints.map((p) => p.x));
  const minY = Math.min(...rawPoints.map((p) => p.y));
  const points = rawPoints.map((p) => ({ x: +(p.x - minX).toFixed(2), y: +(p.y - minY).toFixed(2) }));
  const coordSystem = typeof json.coordSystem === "string" ? json.coordSystem : null;
  const notes = [typeof json.notes === "string" ? json.notes : null, coordSystem && coordSystem.includes("任意") ? `【注意】任意座標系のため、座標の上＝北ではありません。敷地図の「方位」で測量図の方位記号に合わせて向きを設定してください。${typeof json.northHint === "string" ? "（" + json.northHint + "）" : ""}` : null].filter(Boolean).join(" ");
  return {
    site: { points, edges: Array.isArray(json.edges) ? json.edges : [], northDeg: 0, areaOverride: typeof json.areaOverride === "number" ? json.areaOverride : undefined },
    coords: Array.isArray(json.coords) ? (json.coords as { label: string; X: number; Y: number }[]) : null,
    coordSystem,
    notes,
    usage: msg.usage,
  };
}
