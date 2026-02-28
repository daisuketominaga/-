import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `あなたは不動産面談の価値観分析AIです。
お客さんのワーク回答と面談メモから、その人の価値観を分析してください。

出力形式（JSONのみ）：
{
  "radarChart": {
    "stability_vs_adventure": 数値(-100〜100、負=安定志向、正=冒険志向),
    "function_vs_emotion": 数値(-100〜100、負=機能重視、正=情緒重視),
    "private_vs_shared": 数値(-100〜100、負=個人の空間、正=家族の共有空間),
    "urban_vs_nature": 数値(-100〜100、負=都市的、正=自然的),
    "asset_vs_lifestyle": 数値(-100〜100、負=資産形成、正=暮らしの豊かさ)
  },
  "keywords": ["キーワード1", "キーワード2", ...（6〜8個）],
  "summary": "この方の価値観の要約（200〜300字）"
}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const body = await request.json();
    const { priorities, idealDay, tradeoffs, letter, topValues, keywordsOnly } =
      body;

    // キーワードのみのリクエスト（Step5用）
    if (keywordsOnly) {
      if (!apiKey) {
        return NextResponse.json({
          keywords: [
            "家族の時間",
            "朝の静けさ",
            "庭のある暮らし",
            "子どもの笑い声",
            "自然とのつながり",
            "安心できる場所",
            "成長する住まい",
            "街の便利さ",
          ],
        });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system:
            "以下の価値観ワーク回答をもとに、この人の価値観を表すキーワードを6〜8個抽出してください。JSON配列のみで返答してください。例: [\"家族の時間\", \"朝の静けさ\"]",
          messages: [
            {
              role: "user",
              content: `プライオリティ: ${JSON.stringify(priorities)}\n理想の一日: ${JSON.stringify(idealDay)}\nトレードオフ: ${JSON.stringify(tradeoffs)}\n手紙: ${letter || "なし"}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          return NextResponse.json({ keywords: JSON.parse(match[0]) });
        }
      }

      return NextResponse.json({
        keywords: [
          "家族の時間",
          "朝の静けさ",
          "庭のある暮らし",
          "子どもの笑い声",
          "自然とのつながり",
          "安心できる場所",
          "成長する住まい",
          "街の便利さ",
        ],
      });
    }

    // 完全な価値観マップ生成
    if (!apiKey) {
      return NextResponse.json(generateFallbackMap(priorities, tradeoffs));
    }

    let userMessage = `以下の回答をもとに価値観を分析してください。\n\n`;
    userMessage += `【プライオリティ】\n${JSON.stringify(priorities)}\n\n`;
    userMessage += `【理想の一日】\n${JSON.stringify(idealDay)}\n\n`;
    userMessage += `【トレードオフ選択】\n${JSON.stringify(tradeoffs)}\n\n`;
    if (letter) userMessage += `【家族への手紙】\n${letter}\n\n`;
    if (topValues?.length)
      userMessage += `【大切にしたい3つ】\n${topValues.join("、")}\n`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return NextResponse.json(JSON.parse(jsonMatch[0]));
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("Value map error:", error);
    return NextResponse.json(
      generateFallbackMap(
        (await request.clone().json()).priorities,
        (await request.clone().json()).tradeoffs
      )
    );
  }
}

function generateFallbackMap(
  priorities: Record<string, number> | undefined,
  tradeoffs: { pair: [string, string]; choice: string }[] | undefined
) {
  const p = priorities || {};
  const t = tradeoffs || [];

  // プライオリティからレーダーチャートを推定
  const urban = (p.convenience || 50) - (p.nature || 50);
  const asset = (p.asset_value || 50) - ((p.childcare || 50) + (p.hobby_space || 50)) / 2;
  const priv = (p.privacy || 50) - (p.relationships || 50);

  // トレードオフからも推定
  let adventure = 0;
  let emotion = 0;
  t.forEach((trade) => {
    if (trade.pair[0] === "駅徒歩5分") {
      adventure += trade.choice === "B" ? 30 : trade.choice === "A" ? -30 : 0;
    }
    if (trade.pair[0] === "資産価値が高い") {
      emotion += trade.choice === "B" ? 40 : trade.choice === "A" ? -40 : 0;
    }
  });

  return {
    radarChart: {
      stability_vs_adventure: Math.max(-100, Math.min(100, adventure)),
      function_vs_emotion: Math.max(-100, Math.min(100, emotion || 20)),
      private_vs_shared: Math.max(-100, Math.min(100, -priv)),
      urban_vs_nature: Math.max(-100, Math.min(100, -urban)),
      asset_vs_lifestyle: Math.max(-100, Math.min(100, -asset)),
    },
    keywords: [
      "家族の時間",
      "朝の静けさ",
      "庭のある暮らし",
      "子どもの笑い声",
      "自然とのつながり",
      "安心できる場所",
    ],
    summary:
      "面談とワークの結果から、この方は家族との時間や暮らしの豊かさを重視される傾向が見られます。物件の条件よりも、そこでどのような日々を過ごせるかを大切にされています。",
  };
}
