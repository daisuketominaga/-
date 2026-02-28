import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `あなたは不動産の面談アシスタントです。
営業担当者が入力した面談メモから、お客さんの「情緒的価値」を引き出すための
次の質問を提案してください。

ルール：
- 物件のスペックに関する質問は絶対にしない
- 「暮らしの情景」「家族の未来」「隠れた価値観」の3カテゴリから提案する
- お客さんが既に答えた内容を踏まえて、より深い問いを投げる
- 押しつけがましくならない、自然な会話の延長として使える問いにする
- 1回に3つまで提案する

出力形式（JSONのみ）：
{
  "suggestions": [
    { "question": "質問文", "category": "暮らしの情景" },
    { "question": "質問文", "category": "家族の未来" },
    { "question": "質問文", "category": "隠れた価値観" }
  ]
}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // フォールバック：API キー未設定時のデフォルト提案
    return NextResponse.json({
      suggestions: [
        {
          question:
            "理想の休日の朝はどんな朝ですか？目覚めた瞬間から教えてください。",
          category: "暮らしの情景",
        },
        {
          question:
            "お子さんが大きくなった時、この家をどう思い出してほしいですか？",
          category: "家族の未来",
        },
        {
          question:
            "人生で一番「家」を感じた瞬間は、いつのどんな時ですか？",
          category: "隠れた価値観",
        },
      ],
    });
  }

  try {
    const body = await request.json();
    const { customer, notes, valueWork } = body;

    let userMessage = "以下の面談情報をもとに、次の問いかけを3つ提案してください。\n\n";

    if (customer) {
      userMessage += `【お客さん情報】\n`;
      userMessage += `名前：${customer.name}\n`;
      if (customer.age) userMessage += `年齢：${customer.age}歳\n`;
      if (customer.family?.spouse)
        userMessage += `配偶者：${customer.family.spouse.name}（${customer.family.spouse.age}歳）\n`;
      if (customer.family?.children?.length > 0)
        userMessage += `お子さん：${customer.family.children.map((c: { name: string; age: number }) => `${c.name}（${c.age}歳）`).join("、")}\n`;
      if (customer.purchasePurpose)
        userMessage += `購入目的：${customer.purchasePurpose}\n`;
      userMessage += "\n";
    }

    if (notes && notes.length > 0) {
      userMessage += `【面談メモ】\n`;
      notes.forEach(
        (n: { content: string; category: string }, i: number) => {
          userMessage += `${i + 1}. [${n.category}] ${n.content}\n`;
        }
      );
      userMessage += "\n";
    }

    if (valueWork) {
      userMessage += `【ワーク回答（一部）】\n`;
      if (valueWork.priorities) {
        userMessage += `プライオリティ：${JSON.stringify(valueWork.priorities)}\n`;
      }
      if (valueWork.idealDay?.morning_activity) {
        userMessage += `理想の朝：${valueWork.idealDay.morning_activity}\n`;
      }
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text =
      data.content?.[0]?.text || "";

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("AI suggestions error:", error);
    return NextResponse.json({
      suggestions: [
        {
          question:
            "家に帰ってきた瞬間、最初にしたいことは何ですか？",
          category: "暮らしの情景",
        },
        {
          question: "10年後の家族の風景はどんなイメージですか？",
          category: "家族の未来",
        },
        {
          question:
            "もしお金が関係なかったら、どこに住みたいですか？その理由は？",
          category: "隠れた価値観",
        },
      ],
    });
  }
}
