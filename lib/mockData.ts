import { Session, Customer, ValueWork, ValueMap, Interview, ProposalLetter } from "@/types";

const mockCustomers: Customer[] = [
  {
    id: "c1",
    name: "田中 太郎",
    age: 35,
    family: {
      spouse: { name: "田中 花子", age: 33 },
      children: [
        { name: "田中 翔", age: 5 },
        { name: "田中 美咲", age: 2 },
      ],
    },
    purchasePurpose: "初めての購入",
    budget: { min: 3500, max: 5000 },
    preferredArea: "東京都世田谷区",
    createdAt: "2026-02-20T10:00:00Z",
    status: "面談済み",
  },
  {
    id: "c2",
    name: "鈴木 一郎",
    age: 42,
    family: {
      spouse: { name: "鈴木 美和", age: 40 },
      children: [{ name: "鈴木 陽向", age: 10 }],
    },
    purchasePurpose: "住み替え",
    budget: { min: 5000, max: 7000 },
    preferredArea: "神奈川県横浜市",
    createdAt: "2026-02-25T14:00:00Z",
    status: "レター送付済み",
  },
  {
    id: "c3",
    name: "佐藤 麻衣",
    age: 29,
    family: {
      children: [],
    },
    purchasePurpose: "初めての購入",
    preferredArea: "東京都目黒区",
    createdAt: "2026-02-27T09:00:00Z",
    status: "事前準備",
  },
];

const mockValueWork: ValueWork = {
  id: "vw1",
  customerId: "c1",
  step1Priorities: {
    commute: 60,
    childcare: 90,
    nature: 75,
    socialDistance: 40,
    privacy: 55,
    assetValue: 45,
    convenience: 50,
    hobby: 70,
  },
  step2IdealDay: {
    morningActivity: "子どもたちと庭で朝食を食べる",
    eveningScene: "温かいリビングで家族が笑っている",
    weekendActivities: ["公園で遊ぶ", "料理を一緒にする", "自然の中で過ごす"],
  },
  step3Tradeoffs: [
    { pair: ["駅徒歩5分", "庭付き一戸建て"], choice: "B", reason: "子どもたちに庭で遊んでほしい" },
    { pair: ["都心のマンション", "郊外の広い家"], choice: "B" },
    { pair: ["築浅で狭い", "築古でリノベ済みの広い家"], choice: "B", reason: "自分たちらしい空間にしたい" },
    { pair: ["資産価値が高い", "自分の好みに合う"], choice: "B" },
    { pair: ["利便性が高い", "静かで落ち着いた環境"], choice: "B", reason: "静かな環境で子育てしたい" },
  ],
  step4Letter:
    "5年後の家族へ。翔と美咲が大きくなって、庭で元気に走り回っている姿を想像しています。この家を選んだことを、きっと良かったと思えているはず。花子と二人で選んだこの場所で、たくさんの思い出を作ろうね。",
  step5TopValues: ["子どもの笑い声が響く暮らし", "自然を感じる毎日", "家族の温かい食卓"],
  completedAt: "2026-02-20T11:30:00Z",
  currentStep: 6,
};

const mockValueMap: ValueMap = {
  id: "vm1",
  customerId: "c1",
  radarChart: {
    stability_vs_adventure: -30,
    function_vs_emotion: 60,
    private_vs_shared: 40,
    urban_vs_nature: 55,
    asset_vs_lifestyle: 70,
  },
  keywords: [
    { word: "子どもの笑い声", weight: 95 },
    { word: "庭のある暮らし", weight: 88 },
    { word: "家族の食卓", weight: 85 },
    { word: "自然の近さ", weight: 78 },
    { word: "静かな環境", weight: 72 },
    { word: "リノベーション", weight: 65 },
    { word: "朝の光", weight: 60 },
    { word: "温かいリビング", weight: 58 },
  ],
  summary:
    "田中様は「家族の時間の豊かさ」を最も大切にされています。特にお子さんたちが自然の中でのびのびと育つ環境を強く望んでおり、資産価値よりも「暮らしの質」を重視される傾向が見られます。庭付きの一戸建てで、自分たちらしくリノベーションした空間で、温かい家族の時間を過ごすことが理想の暮らしの姿です。",
  generatedAt: "2026-02-20T11:35:00Z",
};

const mockInterview: Interview = {
  id: "i1",
  customerId: "c1",
  date: "2026-02-20T10:00:00Z",
  duration: 45,
  notes: [
    {
      timestamp: "2026-02-20T10:05:00Z",
      content: "お子さんの話になると表情が明るくなる。特に「庭」というキーワードに反応が強い。",
      category: "暮らしの情景",
    },
    {
      timestamp: "2026-02-20T10:15:00Z",
      content: "奥様は「静かな環境」を重視。ご主人は「通勤」も気にしているが、家族の意見を優先したい様子。",
      category: "家族の未来",
    },
    {
      timestamp: "2026-02-20T10:25:00Z",
      content: "「この家で子どもたちが大きくなった時、ここで育ってよかったと思ってほしい」という言葉が印象的。",
      category: "隠れた価値観",
    },
  ],
  aiSuggestions: [
    {
      timestamp: "2026-02-20T10:10:00Z",
      question: "お子さんが大きくなった時、この家をどう思い出してほしいですか？",
      category: "家族の未来",
      used: true,
    },
    {
      timestamp: "2026-02-20T10:20:00Z",
      question: "もしお金が関係なかったら、どんな場所に住みたいですか？",
      category: "隠れた価値観",
      used: true,
    },
    {
      timestamp: "2026-02-20T10:30:00Z",
      question: "家に帰ってきた瞬間、最初に感じたい「匂い」や「音」はありますか？",
      category: "暮らしの情景",
      used: false,
    },
  ],
};

const mockProposalLetter: ProposalLetter = {
  id: "pl1",
  customerId: "c1",
  interviewId: "i1",
  aiDraft: `田中太郎 様・花子 様へ

本日は貴重なお時間をいただき、ありがとうございました。お二人とお子さんたちの未来について、一緒にお話しできたことをとても嬉しく思います。

■ 私が理解した、あなたの大切にしていること

お話を通じて最も強く感じたのは、太郎さんと花子さんが「家族の時間の豊かさ」を何よりも大切にされているということです。

翔くんと美咲ちゃんが庭で元気に遊ぶ姿、家族みんなで食卓を囲む時間、休日に近くの公園で過ごすひととき——そういった「日常の中にある幸せ」こそが、お二人にとっての理想の暮らしなのだと感じました。

花子さんが大切にされている「静けさ」と、太郎さんが気にされている「通勤の利便性」。この二つは一見相反するように見えますが、実は「家族みんなが笑顔でいられる暮らし」という同じ根っこから生まれている想いだと私は理解しました。

■ あなたの暮らしの理想像

朝、庭に面したリビングに柔らかい光が差し込む。翔くんが「パパ、お庭行こう！」と駆け寄ってくる。花子さんはキッチンでコーヒーを淹れながら、窓越しにそんな二人を微笑んで見ている。美咲ちゃんはまだ少し眠そうに、リビングのソファでごろごろしている——そんな朝の情景が、お二人の理想の暮らしの原風景なのだと思います。

■ 物件選びで大切にしてほしいこと

条件で物件を絞り込む前に、ぜひ「この家で家族の朝はどんな朝になるだろう？」と想像してみてください。間取りや築年数は変えられますが、窓から見える景色や、近所の空気感は変えられません。お二人の価値観に最も合う「場所の空気」を大切にしていただきたいと思います。

■ 最後に

（ここにトミーさんの個人的なメッセージを添えてください）

株式会社イチエン不動産
富永大介`,
  editedContent: "",
  personalNote: "",
};

const mockSessions: Session[] = [
  {
    id: "s1",
    customerId: "c1",
    customer: mockCustomers[0],
    interview: mockInterview,
    valueWork: mockValueWork,
    valueMap: mockValueMap,
    proposalLetter: mockProposalLetter,
    status: "完了",
    createdAt: "2026-02-20T09:50:00Z",
  },
  {
    id: "s2",
    customerId: "c2",
    customer: mockCustomers[1],
    status: "準備中",
    createdAt: "2026-02-25T13:50:00Z",
  },
  {
    id: "s3",
    customerId: "c3",
    customer: mockCustomers[2],
    status: "準備中",
    createdAt: "2026-02-27T08:50:00Z",
  },
];

export function getSessions(): Session[] {
  return mockSessions;
}

export function getSession(id: string): Session | undefined {
  return mockSessions.find((s) => s.id === id);
}

export function getCustomers(): Customer[] {
  return mockCustomers;
}

export function getMockValueWork(): ValueWork {
  return mockValueWork;
}

export function getMockValueMap(): ValueMap {
  return mockValueMap;
}

export function createEmptyValueWork(customerId: string): ValueWork {
  return {
    id: `vw-${Date.now()}`,
    customerId,
    step1Priorities: {},
    step2IdealDay: {
      morningActivity: "",
      eveningScene: "",
      weekendActivities: [],
    },
    step3Tradeoffs: [],
    step4Letter: "",
    step5TopValues: [],
    currentStep: 1,
  };
}
