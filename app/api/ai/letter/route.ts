import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `あなたはイチエン不動産の営業担当・富永大介の文章アシスタントです。
以下の面談データをもとに、お客さん宛ての「提案レター」を作成してください。

トーンと文体：
- 温かく、誠実で、押しつけがましくない
- 営業的な表現は一切使わない
- 「売りたい」ではなく「理解したい」という姿勢
- お客さんが「この人は本当に自分のことをわかってくれた」と感じる文章
- 専門用語は避け、日常の言葉で書く

構成：
1. 面談のお礼（1〜2文）
2. 「私が理解した、あなたの大切にしていること」（3〜4段落）
3. 「あなたの暮らしの理想像」（具体的な情景描写）
4. 「物件選びで大切にしてほしいこと」（価値観ベースのアドバイス）
5. 「最後に」（営業担当の個人的メッセージの枠。ここはドラフトのみ）

禁止事項：
- 物件の具体的な提案はしない
- 価格や条件の話はしない
- 「お急ぎください」「今がチャンス」などの煽り表現

出力はプレーンテキストで、見出しは■を使ってください。`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const body = await request.json();
    const { customer, notes, valueWork, valueMap } = body;

    if (!apiKey) {
      return NextResponse.json({
        letter: generateFallbackLetter(customer, valueWork, valueMap),
      });
    }

    let userMessage = `以下の面談データをもとに提案レターを作成してください。\n\n`;

    if (customer) {
      userMessage += `【お客さん情報】\n`;
      userMessage += `名前：${customer.name}\n`;
      if (customer.age) userMessage += `年齢：${customer.age}歳\n`;
      if (customer.family?.spouse)
        userMessage += `配偶者：${customer.family.spouse.name}（${customer.family.spouse.age}歳）\n`;
      if (customer.family?.children?.length > 0)
        userMessage += `お子さん：${customer.family.children.map((c: { name: string; age: number }) => `${c.name}（${c.age}歳）`).join("、")}\n`;
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
      userMessage += `【ワーク回答】\n`;
      if (valueWork.idealDay?.morning_activity)
        userMessage += `理想の朝：${valueWork.idealDay.morning_activity}\n`;
      if (valueWork.idealDay?.evening_scene)
        userMessage += `理想の夕方：${valueWork.idealDay.evening_scene}\n`;
      if (valueWork.idealDay?.weekend_activities?.length)
        userMessage += `週末の過ごし方：${valueWork.idealDay.weekend_activities.join("、")}\n`;
      if (valueWork.letter) userMessage += `家族への手紙：${valueWork.letter}\n`;
      if (valueWork.topValues?.length)
        userMessage += `大切にしたい3つ：${valueWork.topValues.join("、")}\n`;
      userMessage += "\n";
    }

    if (valueMap) {
      userMessage += `【価値観マップ要約】\n${valueMap.summary || ""}\n`;
      if (valueMap.keywords?.length)
        userMessage += `キーワード：${valueMap.keywords.map((k: { word: string }) => k.word).join("、")}\n`;
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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    return NextResponse.json({ letter: text });
  } catch (error) {
    console.error("Letter generation error:", error);
    const body = await request.clone().json();
    return NextResponse.json({
      letter: generateFallbackLetter(body.customer, body.valueWork, body.valueMap),
    });
  }
}

function generateFallbackLetter(
  customer: { name: string } | null,
  valueWork: {
    idealDay?: { morning_activity?: string; evening_scene?: string };
    topValues?: string[];
    letter?: string;
  } | null,
  valueMap: { summary?: string; keywords?: { word: string }[] } | null
) {
  const name = customer?.name || "お客様";
  const topValues = valueWork?.topValues || [];
  const morning = valueWork?.idealDay?.morning_activity || "";
  const evening = valueWork?.idealDay?.evening_scene || "";
  const summary = valueMap?.summary || "";

  return `${name} 様へ

本日は貴重なお時間をいただき、ありがとうございました。
${name}様の「理想の暮らし」について、じっくりとお話しいただけたこと、大変嬉しく思います。

■ 私が理解した、あなたの大切にしていること

${topValues.length > 0 ? `お話の中で特に印象的だったのは、「${topValues[0]}」を大切にされている点です。` : "今日のお話を通じて、住まいに対する深い想いを感じました。"}

${topValues.length > 1 ? `また、「${topValues[1]}」や「${topValues.length > 2 ? topValues[2] : "日々の暮らしの質"}」についてのお考えも、とても明確でいらっしゃいました。` : ""}

${summary || "物件の条件だけでは測れない、暮らしへの願いを確かに受け取りました。"}

■ あなたの暮らしの理想像

${morning ? `朝は「${morning}」から始まる一日。` : "穏やかな朝から始まる毎日。"}
${evening ? `夕方には「${evening}」——そんな光景が目に浮かびます。` : ""}

ご家族にとって、住まいは単なる建物ではなく、日々の幸せを育む場所なのだと、改めて感じました。

■ 物件選びで大切にしてほしいこと

条件や数字に惑わされず、まずは「ここで暮らしている自分」を想像してみてください。
玄関を開けた瞬間、リビングに光が差し込む午後、家族が集まる食卓——
その情景に心が温かくなるかどうかが、何よりも大切な判断基準だと私は考えています。

■ 最後に

（ここにトミーさんの個人的なメッセージを記入してください）

株式会社イチエン不動産
富永大介`;
}
