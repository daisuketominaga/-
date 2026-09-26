// ===== 共通の型定義（単位は m、座標は x=東、y=北 の右手系）=====

export type Pt = { x: number; y: number };

export type SiteEdge = {
  /** 辺の始点インデックス（points[i] → points[i+1]） */
  index: number;
  /** 測量図に書かれた辺長（m）。未入力なら座標から計算 */
  length?: number;
  /** 道路に接している辺か */
  road?: boolean;
  /** 道路幅員（m） */
  roadWidth?: number;
  /** 道路種別の表示（例: 法42条1項1号 公道） */
  roadLabel?: string;
  /** 補足メモ（例: NTT柱有） */
  note?: string;
};

export type Site = {
  /** 敷地の境界点（時計回り or 反時計回り） */
  points: Pt[];
  edges: SiteEdge[];
  /** 北の向き。0 = 画面上が北。時計回りの度数 */
  northDeg: number;
  /** 測量図に書かれた面積（m2）。未入力なら座標から計算 */
  areaOverride?: number;
  /** 建ぺい率 % */
  coverageRatio: number;
  /** 容積率 % */
  farRatio: number;
  /** 民法234条の離れ（m）。標準 0.5 */
  setback: number;
  /** 防火・準防火地域で外壁が耐火構造（建築基準法65条）→ 離れ線を非表示 */
  fireproofException: boolean;
  /** 高さ制限のチェック用（値は物件ごとに役所で確認して入力） */
  heightRules?: HeightRules;
};

export type HeightRules = {
  /** 用途地域（heightPresets の ZONE_PRESETS の id）。道路斜線の勾配・適用距離・北側斜線・隣地斜線を決める */
  zoneId: string;
  /** 道路斜線の勾配（住居系 1.25 / その他 1.5）。用途地域から自動、手で上書き可 */
  roadSlope: number;
  /** 道路斜線の適用距離 m */
  roadApplyDist: number;
  /** 北側斜線（低層住専 5m＋1.25、中高層住専 10m＋1.25） */
  northEnabled: boolean;
  northBase: number;
  northSlope: number;
  /** 隣地斜線（住居系 20m＋1.25、その他 31m＋2.5） */
  neighborEnabled: boolean;
  neighborBase: number;
  neighborSlope: number;
  /** 高度地区: プリセット id（"" なら手入力）と区間式 */
  kodoEnabled: boolean;
  kodoPresetId: string;
  kodoSegs: { from: number; upTo: number | null; base: number; slope: number }[];
  kodoAbsolute: number;
  /** 絶対高さ制限 m（低層住専の 10m/12m など。0 なら無し） */
  absoluteMax: number;
  /** 天空率で道路斜線を検討する */
  skyEnabled: boolean;
  /** 旧形式との互換用（使わない） */
  kodoBase?: number;
  kodoSlope?: number;
};

export const DEFAULT_HEIGHT_RULES: HeightRules = {
  zoneId: "",
  roadSlope: 1.25,
  roadApplyDist: 20,
  northEnabled: false,
  northBase: 5,
  northSlope: 1.25,
  neighborEnabled: true,
  neighborBase: 20,
  neighborSlope: 1.25,
  kodoEnabled: false,
  kodoPresetId: "",
  kodoSegs: [],
  kodoAbsolute: 0,
  absoluteMax: 0,
  skyEnabled: true,
};

export type RoofType = "flat" | "shed" | "gable";

export type Building = {
  /** 建物外形（矩形）の左下角の位置（敷地座標 m） */
  x: number;
  y: number;
  /** 幅（東西）・奥行（南北） m */
  w: number;
  d: number;
  /** 回転（度、反時計回り） */
  rotDeg: number;
  floors: number;
  /** 各階の天井高 m */
  floorHeights: number[];
  /** 基礎高 m */
  foundation: number;
  roof: RoofType;
  /** 片流れ屋根が上がっていく向き */
  roofHighSide: "N" | "S" | "E" | "W";
  /** 屋根勾配（寸） */
  roofPitchSun: number;
  wallColor: string;
  accentColor: string;
  wallLabel: string;
  accentLabel: string;
  structureLabel: string;
};

export type RoomType =
  | "ldk"
  | "living"
  | "kitchen"
  | "bedroom"
  | "japanese"
  | "entrance"
  | "hall"
  | "toilet"
  | "bath"
  | "washroom"
  | "closet"
  | "stairs"
  | "garage"
  | "balcony"
  | "storage"
  | "study"
  | "other";

export type StairDir = "up" | "down" | "left" | "right";
/** 階段の形: 直階段 / 回り階段（折り返し・1坪） / かね折れ */
export type StairKind = "straight" | "u_turn" | "l_turn";
/** 曲がる向き（上る人から見て） */
export type TurnSide = "left" | "right";

export type FixtureKind =
  | "door_single" // 片開きドア（室内）
  | "door_entrance" // 玄関 片開き
  | "door_parent_child" // 玄関 親子ドア
  | "sliding_single" // 片引き戸
  | "sliding_double" // 引違い戸
  | "folding" // 折れ戸（クローゼット）
  | "window" // 腰窓
  | "window_terrace" // 掃き出し窓
  | "window_small" // 小窓
  | "opening"; // 開口（建具なし）

/** 建具。壁の上に置く。(x, y) は開口の始点（建物の左下を原点、m）、along は壁の向き */
export type Fixture = {
  id: string;
  kind: FixtureKind;
  x: number;
  y: number;
  along: "h" | "v";
  width: number;
  /** 開き戸: 吊元（開口の始点側 start / 終点側 end） */
  hinge?: "start" | "end";
  /** 開き戸: 開く側（壁の法線の正側 plus = 上/右、負側 minus = 下/左） */
  swing?: "plus" | "minus";
};

export const FIXTURE_LABEL: Record<FixtureKind, string> = {
  door_single: "片開きドア",
  door_entrance: "玄関ドア",
  door_parent_child: "親子ドア",
  sliding_single: "片引き戸",
  sliding_double: "引違い戸",
  folding: "折れ戸",
  window: "腰窓",
  window_terrace: "掃き出し窓",
  window_small: "小窓",
  opening: "開口",
};

/** 一般的な戸建の標準幅（m）。室内建具はLIXILラシッサ、玄関はジエスタ2、窓はサッシ呼称の規格を参考 */
export const FIXTURE_DEFAULT_WIDTH: Record<FixtureKind, number> = {
  door_single: 0.78,
  door_entrance: 0.924,
  door_parent_child: 1.24,
  sliding_single: 1.644,
  sliding_double: 1.644,
  folding: 1.644,
  window: 1.69,
  window_terrace: 1.69,
  window_small: 0.64,
  opening: 0.91,
};

export type Room = {
  id: string;
  name: string;
  type: RoomType;
  /** 階段: 上っていく向き（建物の底辺基準。up=奥へ, down=底辺側へ, left, right） */
  dir?: StairDir;
  /** 階段の形 */
  stairKind?: StairKind;
  /** 回り・かね折れ階段の曲がる向き */
  turn?: TurnSide;
  /** 建物外形の左下角を原点とした位置（m） */
  x: number;
  y: number;
  w: number;
  d: number;
};

export type Floor = {
  level: number;
  rooms: Room[];
  fixtures?: Fixture[];
};

export type Face = "N" | "S" | "E" | "W";

export type Opening = {
  id: string;
  face: Face;
  floor: number;
  /** 面の左端からの位置（m）。面を外から見て左から */
  offset: number;
  width: number;
  height: number;
  /** 床からの高さ m */
  sill: number;
  kind: "window" | "door" | "garage" | "slit";
};

/** 建築可能範囲グリッドの設定 */
export type GridSetting = {
  /** 底辺にする敷地の辺（points[i] → points[i+1]） */
  baseEdge: number;
  /** 底辺の始点から、辺に沿った建物の位置（m、455mm刻み） */
  u: number;
  /** 底辺から内側へ入った建物の位置（m、455mm刻み） */
  v: number;
  /** 180度回転して表示（底辺を画面の上にする） */
  flip?: boolean;
};

export const MODULE = 0.91;
export const HALF = 0.455;

export type Project = {
  name: string;
  address: string;
  catchCopy: string;
  site: Site;
  grid: GridSetting;
  building: Building;
  floors: Floor[];
  openings: Opening[];
  updatedAt: string;
};

export const ROOM_LABEL: Record<RoomType, string> = {
  ldk: "LDK",
  living: "リビング",
  kitchen: "キッチン",
  bedroom: "洋室",
  japanese: "和室",
  entrance: "玄関",
  hall: "廊下",
  toilet: "トイレ",
  bath: "浴室",
  washroom: "洗面・脱衣室",
  closet: "収納",
  stairs: "階段",
  garage: "ガレージ",
  balcony: "バルコニー",
  storage: "納戸",
  study: "スタディ",
  other: "その他",
};

/** 部屋の塗り色（間取り図） */
export const ROOM_FILL: Record<RoomType, string> = {
  ldk: "#f3e2c2",
  living: "#f3e2c2",
  kitchen: "#f3e2c2",
  bedroom: "#e9d5b5",
  japanese: "#dfe8c9",
  entrance: "#d9d9d9",
  hall: "#efe3cf",
  toilet: "#e8f0f6",
  bath: "#dbe9f2",
  washroom: "#e8f0f6",
  closet: "#f5f5f5",
  stairs: "#f9f9f9",
  garage: "#cfd3d8",
  balcony: "#e3e6ea",
  storage: "#f5f5f5",
  study: "#e9d5b5",
  other: "#f0f0f0",
};

/** 畳数に換算するときの1帖の面積（m2）。不動産公正取引協議会の表示規約では1帖=1.62m2以上 */
export const TATAMI_M2 = 1.62;

/** ドラッグで置くときの標準サイズ（m、455mm単位） */
export const ROOM_DEFAULT_SIZE: Record<RoomType, [number, number]> = {
  ldk: [5.46, 4.55],
  living: [3.64, 3.64],
  kitchen: [2.73, 2.275],
  bedroom: [3.64, 3.64],
  japanese: [3.64, 3.64],
  study: [1.82, 1.82],
  entrance: [1.82, 1.365],
  hall: [0.91, 3.64],
  toilet: [0.91, 1.365],
  bath: [1.82, 1.82],
  washroom: [1.82, 1.82],
  closet: [0.91, 0.91],
  storage: [0.91, 1.82],
  stairs: [0.91, 2.73],
  garage: [2.73, 5.46],
  balcony: [3.64, 0.91],
  other: [1.82, 1.82],
};
export const TSUBO_M2 = 3.30578;
