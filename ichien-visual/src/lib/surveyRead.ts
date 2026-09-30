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
- 道路: 図に「道路」「公道」「市道」「県道」「私道」「幅員○m」「法42条」「○○線」などの記載や、道路を表す帯・地番の無い細長い区域が敷地の辺に接していれば、その辺を必ず road:true にし、幅員が読めれば roadWidth（m）、種別が読めれば roadLabel に入れる。道路に接する辺が一つも無い敷地は珍しいので、無い場合は notes にその旨を書く。
- 両面道路・角地: 道路に接する辺は1つとは限らない。敷地の複数の辺（向かい合う2辺や隣り合う2辺）に道路があれば、それぞれの辺を road:true にする。境界点図で敷地の東西それぞれに道路名（「市道○号」「県道○○線」など）が書かれていたら両面道路。
- 道路後退（セットバック）: 幅員が4m未満の道路（法42条2項道路）に接する辺は、道路中心から2m（＝(4 − 幅員) ÷ 2 だけ敷地側へ）後退が必要。その辺に roadSetback（m）を入れる。販売図面や区画図に後退線（点線）と「道路後退部分 ○㎡」「有効宅地 ○㎡」の記載があれば、その数字から後退幅を逆算して roadSetback に入れ、後退後の面積を effectiveArea に入れる。
- 画像が複数あるとき: 1枚目が測量図（座標・辺長の根拠）、2枚目以降は販売図面・区画図・公図など。境界点座標と辺長は測量図を優先し、道路の位置・幅員・種別・後退・面積は販売図面の記載で補う（販売図面の区画図は道路の帯や「法42条○項」「幅員約○m」「後退」「有効面積」が書かれていることが多い）。図面どうしで辺長が食い違うときは notes に書く。
- 面積: 測量図に地積があればそれを areaOverride に。無ければ座標から計算した値を areaOverride に入れずに省略する（アプリが座標から計算する）。販売図面の「土地面積」が後退後の有効面積である場合は effectiveArea に入れ、areaOverride には入れない。

返すJSONの形:
{
  "points": [{"x":0.42,"y":9.19}, ...],
  "edges": [
    {"index":0,"length":8.40},
    {"index":2,"length":9.45,"road":true,"roadWidth":1.8,"roadSetback":1.1,"roadLabel":"法42条2項 公道 市道A-144号"},
    {"index":4,"length":7.63,"road":true,"roadWidth":16.0,"roadLabel":"法42条1項1号 県道○○線","note":"NTT柱有"}
  ],
  "areaOverride": 79.43,
  "effectiveArea": 69.11,
  "coords": [{"label":"K1","X":109.234,"Y":103.087}, ...],
  "coordSystem": "任意座標系" または "平面直角座標系",
  "northHint": "方位記号の見え方（任意座標系のときだけ）",
  "notes": "読み取りで自信のない箇所を一言。求積表から計算した場合はその旨"
}
edges[i].index は points[i] から points[i+1] への辺。道路に接する辺は road:true。
数字が読めない場合は推測せず、その辺の length を省略する。`;

export type SurveyResult = {
  site: { points: { x: number; y: number }[]; edges: unknown[]; northDeg: number; areaOverride?: number; effectiveAreaOverride?: number };
  coords: { label: string; X: number; Y: number }[] | null;
  coordSystem: string | null;
  notes: string;
  usage: unknown;
};

export type SurveyImage = { b64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

/** 測量図の画像（1枚目）と、あれば販売図面・区画図（2枚目以降）を Claude で読み取る */
export async function readSurvey(image: SurveyImage | SurveyImage[], hint?: string): Promise<SurveyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません（Vercelの環境変数に追加してください）");
  const images = Array.isArray(image) ? image : [image];
  const client = new Anthropic({ apiKey });
  // 長い応答でも接続が切れないようストリーミングで受けて最後のメッセージだけ使う
  const msg = await client.messages.stream({
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images.flatMap((im, i) => [
            { type: "text" as const, text: images.length > 1 ? (i === 0 ? "【画像1: 測量図】" : `【画像${i + 1}: 販売図面・区画図など（道路・後退・面積の補足用）】`) : "【測量図】" },
            { type: "image" as const, source: { type: "base64" as const, media_type: im.mediaType, data: im.b64 } },
          ]),
          { type: "text", text: `${images.length > 1 ? "測量図を主に、販売図面で道路・後退・面積を補って" : "この測量図を"}読み取ってJSONで返してください。${hint ? "補足: " + hint : ""}` },
        ],
      },
    ],
  }).finalMessage();
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
  // 辺情報の掃除: 数値でないものは捨てる。後退幅が無くて幅員4m未満なら (4−幅)/2 を補う
  const edges = (Array.isArray(json.edges) ? (json.edges as Record<string, unknown>[]) : [])
    .filter((e) => e && typeof e.index === "number" && (e.index as number) >= 0 && (e.index as number) < points.length)
    .map((e) => {
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
      const road = e.road === true;
      const roadWidth = num(e.roadWidth);
      let roadSetback = road ? num(e.roadSetback) : undefined;
      if (road && roadSetback === undefined && roadWidth !== undefined && roadWidth < 4) roadSetback = +((4 - roadWidth) / 2).toFixed(2);
      return {
        index: e.index as number,
        ...(num(e.length) !== undefined ? { length: num(e.length) } : {}),
        ...(road ? { road: true } : {}),
        ...(roadWidth !== undefined ? { roadWidth } : {}),
        ...(roadSetback !== undefined ? { roadSetback } : {}),
        ...(typeof e.roadLabel === "string" && e.roadLabel ? { roadLabel: e.roadLabel } : {}),
        ...(typeof e.note === "string" && e.note ? { note: e.note } : {}),
      };
    });
  const roadCount = edges.filter((e) => e.road).length;
  const notes2 = [notes, roadCount === 0 ? "道路に接する辺が読み取れませんでした。左の「辺ごとの道路・後退」で道路の辺にチェックしてください。" : roadCount >= 2 ? `道路に接する辺を ${roadCount} つ読み取りました（両面道路・角地）。` : null].filter(Boolean).join(" ");
  return {
    site: {
      points,
      edges,
      northDeg: 0,
      areaOverride: typeof json.areaOverride === "number" ? json.areaOverride : undefined,
      effectiveAreaOverride: typeof json.effectiveArea === "number" ? json.effectiveArea : undefined,
    },
    coords: Array.isArray(json.coords) ? (json.coords as { label: string; X: number; Y: number }[]) : null,
    coordSystem,
    notes: notes2,
    usage: msg.usage,
  };
}
