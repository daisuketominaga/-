// ===== 顧客データ =====
export interface Customer {
  id: string;
  name: string;
  age: number;
  family: {
    spouse?: { name: string; age: number };
    children: { name: string; age: number }[];
  };
  purchasePurpose: "初めての購入" | "住み替え" | "投資" | "相続関連";
  budget?: { min: number; max: number };
  preferredArea?: string;
  createdAt: string;
  status:
    | "事前準備"
    | "面談済み"
    | "レター送付済み"
    | "物件提案中"
    | "成約"
    | "見送り";
}

// ===== 面談データ =====
export interface InterviewNote {
  timestamp: string;
  content: string;
  category: "暮らしの情景" | "家族の未来" | "隠れた価値観" | "その他";
}

export interface AISuggestion {
  timestamp: string;
  question: string;
  category: "暮らしの情景" | "家族の未来" | "隠れた価値観";
  used: boolean;
}

export interface Interview {
  id: string;
  customerId: string;
  date: string;
  duration: number;
  notes: InterviewNote[];
  aiSuggestions: AISuggestion[];
}

// ===== 価値観ワーク =====
export interface TradeoffChoice {
  pair: [string, string];
  choice: "A" | "B" | "neutral";
  reason?: string;
}

export interface ValueWork {
  id: string;
  customerId: string;
  step1Priorities: Record<string, number>;
  step2IdealDay: {
    morningActivity: string;
    eveningScene: string;
    weekendActivities: string[];
  };
  step3Tradeoffs: TradeoffChoice[];
  step4Letter: string;
  step5TopValues: [string, string, string] | [];
  completedAt?: string;
  currentStep: number;
}

// ===== 価値観マップ =====
export interface ValueMap {
  id: string;
  customerId: string;
  radarChart: {
    stability_vs_adventure: number;
    function_vs_emotion: number;
    private_vs_shared: number;
    urban_vs_nature: number;
    asset_vs_lifestyle: number;
  };
  keywords: { word: string; weight: number }[];
  summary: string;
  generatedAt: string;
}

// ===== 提案レター =====
export interface ProposalLetter {
  id: string;
  customerId: string;
  interviewId: string;
  aiDraft: string;
  editedContent: string;
  personalNote: string;
  sentAt?: string;
  sentVia?: string;
}

// ===== セッション =====
export interface Session {
  id: string;
  customerId: string;
  customer: Customer;
  interview?: Interview;
  valueWork?: ValueWork;
  valueMap?: ValueMap;
  proposalLetter?: ProposalLetter;
  status: "準備中" | "面談中" | "分析中" | "完了";
  createdAt: string;
}

// ===== スライダー項目 =====
export const PRIORITY_ITEMS = [
  { key: "commute", label: "通勤の便利さ", icon: "🚃" },
  { key: "childcare", label: "子育て環境", icon: "👶" },
  { key: "nature", label: "自然の近さ", icon: "🌳" },
  { key: "socialDistance", label: "友人・親族との距離", icon: "👨‍👩‍👧" },
  { key: "privacy", label: "静けさ・プライバシー", icon: "🤫" },
  { key: "assetValue", label: "資産価値", icon: "📈" },
  { key: "convenience", label: "街の活気・便利さ", icon: "🏙️" },
  { key: "hobby", label: "趣味・好きなことができる空間", icon: "🎨" },
] as const;

// ===== トレードオフ項目 =====
export const TRADEOFF_PAIRS: [string, string][] = [
  ["駅徒歩5分", "庭付き一戸建て"],
  ["都心のマンション", "郊外の広い家"],
  ["築浅で狭い", "築古でリノベ済みの広い家"],
  ["資産価値が高い", "自分の好みに合う"],
  ["利便性が高い", "静かで落ち着いた環境"],
];

// ===== 週末アクティビティ選択肢 =====
export const WEEKEND_ACTIVITIES = [
  "公園で遊ぶ",
  "料理を一緒にする",
  "映画やゲームを楽しむ",
  "買い物に行く",
  "スポーツをする",
  "友人家族と過ごす",
  "自然の中で過ごす",
  "のんびり家で過ごす",
  "習い事や教室に通う",
  "DIYやガーデニング",
] as const;
