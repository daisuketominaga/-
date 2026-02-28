// ========================================
// 顧客データ
// ========================================
export interface Customer {
  id: string;
  name: string;
  age: number | null;
  family: {
    spouse?: { name: string; age: number };
    children?: { name: string; age: number }[];
  };
  purchase_purpose: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_area: string;
  status:
    | "事前準備"
    | "面談済み"
    | "レター送付済み"
    | "物件提案中"
    | "成約"
    | "見送り";
  created_at: string;
  updated_at: string;
}

// ========================================
// 面談セッション
// ========================================
export interface Session {
  id: string;
  customer_id: string;
  staff_url: string;
  client_url: string;
  status: "準備中" | "進行中" | "完了";
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

// ========================================
// 面談メモ
// ========================================
export interface InterviewNote {
  id: string;
  session_id: string;
  content: string;
  category: "暮らしの情景" | "家族の未来" | "隠れた価値観" | "その他";
  created_at: string;
}

// ========================================
// AI提案（問いかけ）
// ========================================
export interface AISuggestion {
  id: string;
  session_id: string;
  question: string;
  category: "暮らしの情景" | "家族の未来" | "隠れた価値観";
  used: boolean;
  created_at: string;
}

// ========================================
// 価値観ワーク回答
// ========================================
export interface ValueWorkAnswers {
  id: string;
  session_id: string;
  step1_priorities: Record<string, number>;
  step2_ideal_day: {
    morning_activity: string;
    evening_scene: string;
    weekend_activities: string[];
  };
  step3_tradeoffs: TradeoffAnswer[];
  step4_letter: string;
  step5_top_values: string[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeoffAnswer {
  pair: [string, string];
  choice: "A" | "B" | "neutral";
  reason: string;
}

// ========================================
// 価値観マップ
// ========================================
export interface ValueMap {
  id: string;
  session_id: string;
  radar_chart: {
    stability_vs_adventure: number;
    function_vs_emotion: number;
    private_vs_shared: number;
    urban_vs_nature: number;
    asset_vs_lifestyle: number;
  };
  keywords: { word: string; weight: number }[];
  summary: string;
  created_at: string;
}

// ========================================
// 提案レター
// ========================================
export interface ProposalLetter {
  id: string;
  session_id: string;
  ai_draft: string;
  edited_content: string;
  personal_note: string;
  sent_at: string | null;
  sent_via: string | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// ワークの定義データ
// ========================================
export const PRIORITY_ITEMS = [
  { key: "commute", label: "通勤の便利さ" },
  { key: "childcare", label: "子育て環境" },
  { key: "nature", label: "自然の近さ" },
  { key: "relationships", label: "友人・親族との距離" },
  { key: "privacy", label: "静けさ・プライバシー" },
  { key: "asset_value", label: "資産価値" },
  { key: "convenience", label: "街の活気・便利さ" },
  { key: "hobby_space", label: "趣味・好きなことができる空間" },
] as const;

export const TRADEOFF_PAIRS: [string, string][] = [
  ["駅徒歩5分", "庭付き一戸建て"],
  ["都心のマンション", "郊外の広い家"],
  ["築浅で狭い", "築古でリノベ済みの広い家"],
  ["資産価値が高い", "自分の好みに合う"],
  ["利便性が高い", "静かで落ち着いた環境"],
];

export const WEEKEND_OPTIONS = [
  "家族で公園へお出かけ",
  "家でゆっくり映画鑑賞",
  "庭でバーベキュー",
  "近所のカフェでブランチ",
  "子どもと一緒に料理",
  "DIYやガーデニング",
  "友人を招いてホームパーティ",
  "読書や趣味の時間",
];
