/**
 * 高さ制限のプリセット（東京都・神奈川県）。
 *
 * ★ここの数値は、私（AI）が Web 検索の要約から転記したもので、原文（都市計画決定の告示・各自治体の
 *   建築制限一覧）を直接読んで確認できていません。画面では必ず「要確認」と出典を表示し、
 *   実案件では役所または確認検査機関で確認した値に直してから使ってください。
 *
 * 北側の斜線は「真北方向の水平距離 L（m）」に対する高さの上限を、区間ごとの 1 次式で表します。
 *   seg = { upTo: L の上限（null なら無限）, base: 起点高さ, slope: 勾配, from: 区間の始点 L }
 *   高さ ≤ base + slope × (L − from)
 */

export type SlopeSeg = { from: number; upTo: number | null; base: number; slope: number };

export type KodoPreset = {
  id: string;
  pref: "東京都" | "神奈川県";
  city: string;
  name: string;
  /** 北側斜線の区間（空なら斜線なし・絶対高さのみ） */
  segs: SlopeSeg[];
  /** 絶対高さ m（0 = 無し） */
  absoluteMax: number;
  /** 確認状態（true = 告示・取扱基準の原文を読んで転記した） */
  verified: boolean;
  /** 北側に道路等が接するとき、境界線を道路幅の 1/2 だけ外側とみなす（横浜市など）。false なら道路幅の全部（法の北側斜線と同じ） */
  roadHalf?: boolean;
  source: string;
  note?: string;
};

export const KODO_PRESETS: KodoPreset[] = [
  // ===== 東京都（区部で広く使われている都の標準的な 3 種類）=====
  {
    id: "tokyo-1",
    pref: "東京都",
    city: "区部（都の標準）",
    name: "第一種高度地区",
    segs: [{ from: 0, upTo: null, base: 5, slope: 0.6 }],
    absoluteMax: 0,
    verified: false,
    source: "https://www.city.katsushika.lg.jp/_res/projects/default_project/_page_/001/003/624/16300-2.pdf",
    note: "真北 5m＋0.6L（北側斜線と同形）。区によって絶対高さの併用あり",
  },
  {
    id: "tokyo-2",
    pref: "東京都",
    city: "区部（都の標準）",
    name: "第二種高度地区",
    segs: [
      { from: 0, upTo: 8, base: 5, slope: 0.6 },
      { from: 8, upTo: null, base: 9.8, slope: 1.25 },
    ],
    absoluteMax: 0,
    verified: false,
    source: "https://www.city.minato.tokyo.jp/documents/151508/koudochiku.pdf",
    note: "L≦8m: 5m＋0.6L、L＞8m: 9.8m＋1.25(L−8)【転記に自信なし・要原文確認】",
  },
  {
    id: "tokyo-3",
    pref: "東京都",
    city: "区部（都の標準）",
    name: "第三種高度地区",
    segs: [
      { from: 0, upTo: 10, base: 10, slope: 0.6 },
      { from: 10, upTo: null, base: 16, slope: 1.25 },
    ],
    absoluteMax: 0,
    verified: false,
    source: "https://www.city.minato.tokyo.jp/documents/151508/koudochiku.pdf",
    note: "L≦10m: 10m＋0.6L、L＞10m: 16m＋1.25(L−10)【転記に自信なし・要原文確認】",
  },
  // ===== 神奈川県 =====
  {
    id: "yokohama-1",
    pref: "神奈川県",
    city: "横浜市",
    name: "第1種高度地区（10m・北側 5m＋0.6L）",
    segs: [{ from: 0, upTo: null, base: 5, slope: 0.6 }],
    absoluteMax: 10,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）。北側斜線内の12m以下の建築物で市長が認めたものは除外(5)",
  },
  {
    id: "yokohama-2",
    pref: "神奈川県",
    city: "横浜市",
    name: "第2種高度地区（12m・北側 5m＋0.6L）",
    segs: [{ from: 0, upTo: null, base: 5, slope: 0.6 }],
    absoluteMax: 12,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）",
  },
  {
    id: "yokohama-3",
    pref: "神奈川県",
    city: "横浜市",
    name: "第3種高度地区（15m・北側 7m＋0.6L）",
    segs: [{ from: 0, upTo: null, base: 7, slope: 0.6 }],
    absoluteMax: 15,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）",
  },
  {
    id: "yokohama-4",
    pref: "神奈川県",
    city: "横浜市",
    name: "第4種高度地区（20m・北側 7.5m＋0.6L）",
    segs: [{ from: 0, upTo: null, base: 7.5, slope: 0.6 }],
    absoluteMax: 20,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）",
  },
  {
    id: "yokohama-5",
    pref: "神奈川県",
    city: "横浜市",
    name: "第5種高度地区（20m・北側 10m＋0.6L）",
    segs: [{ from: 0, upTo: null, base: 10, slope: 0.6 }],
    absoluteMax: 20,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）。工業地域内では住宅系以外の用途の部分は31m以下まで可（適用除外(7)）",
  },
  {
    id: "yokohama-6",
    pref: "神奈川県",
    city: "横浜市",
    name: "第6種高度地区（20m・北側斜線なし）",
    segs: [],
    absoluteMax: 20,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）",
  },
  {
    id: "yokohama-7",
    pref: "神奈川県",
    city: "横浜市",
    name: "第7種高度地区（31m・北側斜線なし）",
    segs: [],
    absoluteMax: 31,
    verified: true,
    roadHalf: true,
    source: "https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/tetsuduki/kisoku/toriatsukai.files/08_5-4.pdf",
    note: "横浜市建築基準法取扱基準集（令和8年4月版）58〜59頁「横浜国際港都建設計画高度地区（抜粋）」（平成23年10月14日 横浜市告示第506号）の原文から転記。北側に道路・水面・線路敷等が接する場合は幅の1/2だけ外側を境界とみなす（緩和(1)）。敷地が北側隣地より1m以上低い場合は高低差から1mを引いた1/2だけ斜線を高くする（緩和(3)）",
  },
  {
    id: "kawasaki-1",
    pref: "神奈川県",
    city: "川崎市",
    name: "第1種高度地区（10m・5m＋0.6L）",
    segs: [{ from: 0, upTo: null, base: 5, slope: 0.6 }],
    absoluteMax: 10,
    verified: false,
    source: "https://www.city.kawasaki.jp/templates/faq/cmsfiles/contents/0000118/118345/youtochiikiniyoruomonaseigen.pdf",
  },
  {
    id: "kawasaki-2",
    pref: "神奈川県",
    city: "川崎市",
    name: "第2種高度地区（15m・7.5m＋1.25L）",
    segs: [{ from: 0, upTo: null, base: 7.5, slope: 1.25 }],
    absoluteMax: 15,
    verified: false,
    source: "https://www.city.kawasaki.jp/templates/faq/cmsfiles/contents/0000118/118345/youtochiikiniyoruomonaseigen.pdf",
    note: "検索要約: 高さ15m以下、真北 1.25L＋7.5m",
  },
  {
    id: "kawasaki-3",
    pref: "神奈川県",
    city: "川崎市",
    name: "第3種高度地区（要原文確認）",
    segs: [],
    absoluteMax: 0,
    verified: false,
    source: "https://www.city.kawasaki.jp/500/cmsfiles/contents/0000071/71580/youtochiikitounoseigen.pdf",
    note: "検索では数値を確認できず。原文を見て手入力してください",
  },
  {
    id: "kamakura-1",
    pref: "神奈川県",
    city: "鎌倉市",
    name: "第1種高度地区（絶対高さ15m）",
    segs: [],
    absoluteMax: 15,
    verified: false,
    source: "https://www.city.kamakura.kanagawa.jp/plan/documents/koudochikukakutei.pdf",
    note: "検索要約: 第1種15m・第2種20m・第3種31m。北側の式は原文確認",
  },
  {
    id: "kamakura-2",
    pref: "神奈川県",
    city: "鎌倉市",
    name: "第2種高度地区（絶対高さ20m）",
    segs: [],
    absoluteMax: 20,
    verified: false,
    source: "https://www.city.kamakura.kanagawa.jp/plan/documents/koudochikukakutei.pdf",
  },
  {
    id: "kamakura-3",
    pref: "神奈川県",
    city: "鎌倉市",
    name: "第3種高度地区（絶対高さ31m）",
    segs: [],
    absoluteMax: 31,
    verified: false,
    source: "https://www.city.kamakura.kanagawa.jp/plan/documents/koudochikukakutei.pdf",
  },
  {
    id: "yokosuka-1",
    pref: "神奈川県",
    city: "横須賀市",
    name: "第一種中高層住居専用地域の高度地区（15m・北側1.25）",
    segs: [{ from: 0, upTo: null, base: 5, slope: 1.25 }],
    absoluteMax: 15,
    verified: false,
    source: "https://www.city.yokosuka.kanagawa.jp/4805/tokei/documents/youtotiikibetukenntikukisei.pdf",
    note: "検索要約: 最高15m・北側勾配1.25（起点高さは要原文確認）",
  },
  {
    id: "fujisawa-none",
    pref: "神奈川県",
    city: "藤沢市",
    name: "高度地区の指定なし（検索要約による）",
    segs: [],
    absoluteMax: 0,
    verified: false,
    source: "https://www.city.fujisawa.kanagawa.jp/kentiku/machizukuri/kenchiku/kakunin/shinse-kensa/kakushukijun/takasasegen.html",
    note: "市のページの要約では高度地区の指定なし。法55条・56条の制限のみ",
  },
  {
    id: "sagamihara-fujino",
    pref: "神奈川県",
    city: "相模原市",
    name: "旧藤野町区域の高度地区（15m）",
    segs: [],
    absoluteMax: 15,
    verified: false,
    source: "https://www.city.sagamihara.kanagawa.jp/shisei/1026875/faq/jyutaku/1002121.html",
    note: "検索要約: 旧藤野町の第一種中高層住居専用地域に15m。その他の区域は原文確認",
  },
  {
    id: "hiratsuka-ind",
    pref: "神奈川県",
    city: "平塚市",
    name: "工業系の高度地区（工場等31m／その他15m）",
    segs: [],
    absoluteMax: 15,
    verified: false,
    source: "https://www.city.hiratsuka.kanagawa.jp/common/000042331.pdf",
    note: "検索要約のみ。住居系の種別は原文確認",
  },
];

/** 用途地域ごとの法定の高さ制限（法55条・56条・別表第3）。数値は別表第3の転記で要原文確認 */
export type ZonePreset = {
  id: string;
  name: string;
  /** 住居系か（道路斜線 1.25 / 隣地斜線 20m+1.25） */
  residential: boolean;
  /** 低層住専（北側斜線 5m+1.25、絶対高さ 10/12m） */
  lowRise: boolean;
  /** 中高層住専（北側斜線 10m+1.25） */
  midRise: boolean;
  /** 容積率(%) → 適用距離(m) */
  applyDist: (far: number) => number;
};

const resApply = (far: number) => (far <= 200 ? 20 : far <= 300 ? 25 : far <= 400 ? 30 : 35);
const comApply = (far: number) => (far <= 400 ? 20 : far <= 600 ? 25 : far <= 800 ? 30 : far <= 1000 ? 35 : far <= 1100 ? 40 : far <= 1200 ? 45 : 50);
const indApply = (far: number) => (far <= 200 ? 20 : far <= 300 ? 25 : far <= 400 ? 30 : 35);
const noneApply = (far: number) => (far <= 200 ? 20 : far <= 300 ? 25 : 30);

export const ZONE_PRESETS: ZonePreset[] = [
  { id: "1low", name: "第一種低層住居専用地域", residential: true, lowRise: true, midRise: false, applyDist: resApply },
  { id: "2low", name: "第二種低層住居専用地域", residential: true, lowRise: true, midRise: false, applyDist: resApply },
  { id: "denen", name: "田園住居地域", residential: true, lowRise: true, midRise: false, applyDist: resApply },
  { id: "1mid", name: "第一種中高層住居専用地域", residential: true, lowRise: false, midRise: true, applyDist: resApply },
  { id: "2mid", name: "第二種中高層住居専用地域", residential: true, lowRise: false, midRise: true, applyDist: resApply },
  { id: "1res", name: "第一種住居地域", residential: true, lowRise: false, midRise: false, applyDist: resApply },
  { id: "2res", name: "第二種住居地域", residential: true, lowRise: false, midRise: false, applyDist: resApply },
  { id: "quasi", name: "準住居地域", residential: true, lowRise: false, midRise: false, applyDist: resApply },
  { id: "ncom", name: "近隣商業地域", residential: false, lowRise: false, midRise: false, applyDist: comApply },
  { id: "com", name: "商業地域", residential: false, lowRise: false, midRise: false, applyDist: comApply },
  { id: "qind", name: "準工業地域", residential: false, lowRise: false, midRise: false, applyDist: indApply },
  { id: "ind", name: "工業地域", residential: false, lowRise: false, midRise: false, applyDist: indApply },
  { id: "indx", name: "工業専用地域", residential: false, lowRise: false, midRise: false, applyDist: indApply },
  { id: "none", name: "用途地域の指定なし", residential: true, lowRise: false, midRise: false, applyDist: noneApply },
];

export const ZONE_SOURCE = "https://polaris-hs.jp/kiso_chishiki/law_dorosyasen.html";
