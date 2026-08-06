import type { ValueWork, ValueMap, Customer, ProposalLetter, AISuggestion } from "@/types";

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalize(val: number, fromMin: number, fromMax: number): number {
  return clamp(((val - fromMin) / (fromMax - fromMin)) * 200 - 100, -100, 100);
}

export function generateValueMap(valueWork: ValueWork, customer: Customer): ValueMap {
  const p = valueWork.step1Priorities;

  const stabilityScore = (p.commute || 50) + (p.convenience || 50) + (p.assetValue || 50);
  const adventureScore = (p.nature || 50) + (p.hobby || 50) + (p.privacy || 50);
  const stability_vs_adventure = normalize(
    stabilityScore - adventureScore, -150, 150
  );

  let functionScore = 0;
  let emotionScore = 0;
  for (const t of valueWork.step3Tradeoffs) {
    if (t.choice === "A") functionScore += 25;
    else if (t.choice === "B") emotionScore += 25;
  }
  const function_vs_emotion = normalize(
    emotionScore - functionScore, -75, 75
  );

  const private_vs_shared = normalize(
    (p.socialDistance || 50) - (p.privacy || 50), -100, 100
  );

  const urban_vs_nature = normalize(
    (p.nature || 50) - (p.convenience || 50), -100, 100
  );

  const assetChoice = valueWork.step3Tradeoffs[3];
  let assetLifestyleBase = 0;
  if (assetChoice) {
    if (assetChoice.choice === "A") assetLifestyleBase = -60;
    else if (assetChoice.choice === "B") assetLifestyleBase = 60;
  }
  const asset_vs_lifestyle = clamp(
    assetLifestyleBase + normalize((p.hobby || 50) - (p.assetValue || 50), -100, 100) * 0.4,
    -100, 100
  );

  const keywords: { word: string; weight: number }[] = [];

  if (valueWork.step5TopValues.length > 0) {
    valueWork.step5TopValues.forEach((val, i) => {
      keywords.push({ word: val, weight: 95 - i * 5 });
    });
  }

  if (valueWork.step2IdealDay.weekendActivities.length > 0) {
    valueWork.step2IdealDay.weekendActivities.forEach((act, i) => {
      if (!keywords.some((k) => k.word === act)) {
        keywords.push({ word: act, weight: 75 - i * 5 });
      }
    });
  }

  if (valueWork.step2IdealDay.morningActivity) {
    keywords.push({ word: valueWork.step2IdealDay.morningActivity, weight: 70 });
  }

  if (valueWork.step2IdealDay.eveningScene) {
    keywords.push({ word: valueWork.step2IdealDay.eveningScene, weight: 68 });
  }

  const priorityKeywords = [
    { key: "childcare", word: "子育て環境", threshold: 70 },
    { key: "nature", word: "自然の近さ", threshold: 70 },
    { key: "privacy", word: "静かな環境", threshold: 70 },
    { key: "hobby", word: "趣味の空間", threshold: 70 },
    { key: "convenience", word: "街の便利さ", threshold: 70 },
    { key: "commute", word: "通勤の利便性", threshold: 70 },
  ];
  for (const pk of priorityKeywords) {
    if ((p[pk.key] || 0) >= pk.threshold && !keywords.some((k) => k.word === pk.word)) {
      keywords.push({ word: pk.word, weight: Math.round(p[pk.key] * 0.7) });
    }
  }

  const topKeywords = keywords.slice(0, 3).map((k) => k.word).join("、");
  const emotionTendency = function_vs_emotion > 0 ? "情緒的な豊かさ" : "機能的な安心感";
  const areaTendency = urban_vs_nature > 0 ? "自然に近い環境" : "都市的な利便性";

  const summary = `${customer.name}様は「${topKeywords}」を大切にされています。${emotionTendency}を重視し、${areaTendency}を好む傾向があります。${
    asset_vs_lifestyle > 30
      ? "資産価値よりも暮らしの質を優先される姿勢が印象的です。"
      : asset_vs_lifestyle < -30
        ? "堅実な資産形成への意識も高くお持ちです。"
        : "暮らしの質と資産価値のバランスを大切にされています。"
  }`;

  return {
    id: `vm-${Date.now()}`,
    customerId: customer.id,
    radarChart: {
      stability_vs_adventure: Math.round(stability_vs_adventure),
      function_vs_emotion: Math.round(function_vs_emotion),
      private_vs_shared: Math.round(private_vs_shared),
      urban_vs_nature: Math.round(urban_vs_nature),
      asset_vs_lifestyle: Math.round(asset_vs_lifestyle),
    },
    keywords: keywords.slice(0, 8),
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export function generateProposalLetter(
  customer: Customer,
  valueMap: ValueMap,
  _notes: { content: string }[]
): ProposalLetter {
  const topKeywords = valueMap.keywords.slice(0, 3).map((k) => k.word);
  const spouseName = customer.family.spouse?.name;
  const hasChildren = customer.family.children.length > 0;

  const greeting = spouseName
    ? `${customer.name} 様・${spouseName} 様へ`
    : `${customer.name} 様へ`;

  const familyContext = hasChildren
    ? `お子さん${customer.family.children.length > 1 ? "たち" : ""}の成長を見守りながら、家族みんなが笑顔でいられる暮らし`
    : spouseName
      ? "お二人が心地よく、自分たちらしく暮らせる空間"
      : "ご自身が本当に心地よいと感じる暮らし";

  const draft = `${greeting}

本日は貴重なお時間をいただき、ありがとうございました。${spouseName ? "お二人と" : ""}お話しできたことをとても嬉しく思います。

■ 私が理解した、あなたの大切にしていること

お話を通じて最も強く感じたのは、${customer.name.split(" ")[0]}さんが「${topKeywords[0]}」を何よりも大切にされているということです。

${topKeywords[1] ? `「${topKeywords[1]}」や「${topKeywords[2] || "日々の安心感"}」——そういった価値観が、${customer.name.split(" ")[0]}さんの暮らしの土台になっているのだと感じました。` : ""}

${valueMap.summary}

■ あなたの暮らしの理想像

${familyContext}——それが${customer.name.split(" ")[0]}さんの目指す理想の姿なのだと思います。

${valueMap.keywords.length > 4 ? `「${valueMap.keywords[3].word}」や「${valueMap.keywords[4].word}」というキーワードからも、${customer.name.split(" ")[0]}さんが日常の中にある幸せを大切にされていることが伝わってきます。` : ""}

■ 物件選びで大切にしてほしいこと

条件で物件を絞り込む前に、ぜひ「この家で自分たちの朝はどんな朝になるだろう？」と想像してみてください。間取りや築年数は変えられますが、窓から見える景色や、近所の空気感は変えられません。

${customer.name.split(" ")[0]}さんの価値観に最も合う「場所の空気」を大切にしていただきたいと思います。

■ 最後に

（ここにトミーさんの個人的なメッセージを添えてください）

株式会社イチエン不動産
富永大介`;

  return {
    id: `pl-${Date.now()}`,
    customerId: customer.id,
    interviewId: "",
    aiDraft: draft,
    editedContent: "",
    personalNote: "",
  };
}

const QUESTION_POOL: AISuggestion[] = [
  { timestamp: "", question: "家に帰ってきた瞬間、最初にしたいことは何ですか？", category: "暮らしの情景", used: false },
  { timestamp: "", question: "理想の休日の朝はどんな朝ですか？", category: "暮らしの情景", used: false },
  { timestamp: "", question: "家の中で一番好きな場所はどこですか？その理由は？", category: "暮らしの情景", used: false },
  { timestamp: "", question: "窓から見えてほしい景色はありますか？", category: "暮らしの情景", used: false },
  { timestamp: "", question: "家の中で聞こえてほしい音は何ですか？", category: "暮らしの情景", used: false },
  { timestamp: "", question: "お子さんが大きくなった時、この家をどう思い出してほしいですか？", category: "家族の未来", used: false },
  { timestamp: "", question: "10年後の家族の風景を想像してみてください。何が見えますか？", category: "家族の未来", used: false },
  { timestamp: "", question: "お子さんに「家」について何を伝えたいですか？", category: "家族の未来", used: false },
  { timestamp: "", question: "将来、お友だちを家に呼ぶとしたらどんな時間を過ごしたいですか？", category: "家族の未来", used: false },
  { timestamp: "", question: "5年後、家族でどんな週末を過ごしていたいですか？", category: "家族の未来", used: false },
  { timestamp: "", question: "もしお金が関係なかったら、どんな場所に住みたいですか？", category: "隠れた価値観", used: false },
  { timestamp: "", question: "人生で一番「家」を感じた瞬間はいつですか？", category: "隠れた価値観", used: false },
  { timestamp: "", question: "「ここに住んでよかった」と感じるのはどんな瞬間だと思いますか？", category: "隠れた価値観", used: false },
  { timestamp: "", question: "家を選ぶ時に、絶対に譲れないことは何ですか？", category: "隠れた価値観", used: false },
  { timestamp: "", question: "住まいに求める「安心感」とは具体的にどんなことですか？", category: "隠れた価値観", used: false },
];

export function generateAISuggestions(usedQuestions: string[]): AISuggestion[] {
  const available = QUESTION_POOL.filter(
    (q) => !usedQuestions.includes(q.question)
  );

  const categories: AISuggestion["category"][] = ["暮らしの情景", "家族の未来", "隠れた価値観"];
  const result: AISuggestion[] = [];

  for (const cat of categories) {
    const catQuestions = available.filter((q) => q.category === cat);
    if (catQuestions.length > 0) {
      const picked = catQuestions[usedQuestions.length % catQuestions.length];
      result.push({ ...picked, timestamp: new Date().toISOString() });
    }
  }

  return result;
}

export function generateEmotionSignals(valueWork: ValueWork): { icon: string; message: string }[] {
  const signals: { icon: string; message: string }[] = [];

  if (valueWork.step1Priorities.childcare >= 80) {
    signals.push({ icon: "🔥", message: "「子育て環境」への関心がとても高いです" });
  }

  const neutralCount = valueWork.step3Tradeoffs.filter((t) => t.choice === "neutral").length;
  if (neutralCount >= 2) {
    signals.push({ icon: "💭", message: `トレードオフで${neutralCount}回「どちらでもない」を選択 — 葛藤が見られます` });
  }

  if (valueWork.step4Letter && valueWork.step4Letter.length > 50) {
    signals.push({ icon: "✨", message: "手紙を丁寧に書いています（深い感情が動いている可能性）" });
  } else if (valueWork.step4Letter === "") {
    signals.push({ icon: "📝", message: "手紙はスキップされました" });
  }

  const reasonCount = valueWork.step3Tradeoffs.filter((t) => t.reason && t.reason.length > 0).length;
  if (reasonCount >= 3) {
    signals.push({ icon: "💡", message: `${reasonCount}つの選択に理由を記入 — 言語化への意欲が高いです` });
  }

  if (signals.length === 0) {
    signals.push({ icon: "👀", message: "回答を分析中です..." });
  }

  return signals;
}

export function generateValueKeywords(valueWork: ValueWork): string[] {
  const keywords: string[] = [];

  const topPriorities = Object.entries(valueWork.step1Priorities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const labelMap: Record<string, string> = {
    commute: "通勤の利便性",
    childcare: "子育てに寄り添う暮らし",
    nature: "自然を感じる毎日",
    socialDistance: "大切な人との距離",
    privacy: "静かで穏やかな空間",
    assetValue: "堅実な資産形成",
    convenience: "街の活気と便利さ",
    hobby: "好きなことに没頭できる時間",
  };

  for (const [key] of topPriorities) {
    if (labelMap[key]) keywords.push(labelMap[key]);
  }

  if (valueWork.step2IdealDay.morningActivity) {
    keywords.push(valueWork.step2IdealDay.morningActivity);
  }

  for (const act of valueWork.step2IdealDay.weekendActivities.slice(0, 2)) {
    keywords.push(act);
  }

  return [...new Set(keywords)].slice(0, 8);
}
