import type { Project, Floor, Opening } from "./types";
import { DEFAULT_HEIGHT_RULES } from "./types";
import { buildingFromGrid } from "./grid";

/** 参考画像（藤沢市鵠沼松が岡4丁目）に近い形のサンプル */
export function sampleProject(): Project {
  // 西側が道路。北辺8.40、東辺9.19、南辺8.14、南西の隅切り1.35、西辺7.63＋0.42（ほぼ一直線）
  const points = [
    { x: 0.3, y: 9.19 }, // K1 北西
    { x: 8.7, y: 9.19 }, // K12 北東
    { x: 8.7, y: 0 }, // K11 南東
    { x: 0.56, y: 0 }, // K10 南西（隅切り下）
    { x: 0.0, y: 1.2 }, // K9 隅切り上
    { x: 0.284, y: 8.77 }, // K7（NTT柱）
  ];
  // 8×7.5マス（7.28×6.825m）に収まる、455mm刻みの参考プラン
  const floors: Floor[] = [
    {
      level: 1,
      rooms: [
        { id: "r1", name: "ガレージ", type: "garage", x: 0, y: 0, w: 3.64, d: 3.185 },
        { id: "r2", name: "玄関", type: "entrance", x: 3.64, y: 0, w: 1.82, d: 1.365 },
        { id: "r3", name: "ホール", type: "hall", x: 3.64, y: 1.365, w: 1.82, d: 1.82 },
        { id: "r4", name: "トイレ", type: "toilet", x: 5.46, y: 0, w: 0.91, d: 1.82 },
        { id: "r5", name: "収納", type: "closet", x: 6.37, y: 0, w: 0.91, d: 1.82 },
        { id: "r6", name: "階段", type: "stairs", x: 5.46, y: 1.82, w: 1.82, d: 1.82, dir: "up", stairKind: "u_turn", turn: "left" },
        { id: "r7", name: "廊下", type: "hall", x: 0, y: 3.185, w: 5.46, d: 0.91 },
        { id: "r8", name: "洋室", type: "bedroom", x: 0, y: 4.095, w: 3.64, d: 2.73 },
        { id: "r9", name: "洗面・脱衣室", type: "washroom", x: 3.64, y: 4.095, w: 1.82, d: 1.365 },
        { id: "r10", name: "浴室", type: "bath", x: 3.64, y: 5.46, w: 1.82, d: 1.365 },
        { id: "r11", name: "WCL", type: "closet", x: 5.46, y: 3.64, w: 1.82, d: 3.185 },
      ],
      fixtures: [
        { id: "x1", kind: "opening", x: 0.455, y: 0, along: "h", width: 2.73 },
        { id: "x2", kind: "door_entrance", x: 4.095, y: 0, along: "h", width: 0.924, hinge: "start", swing: "plus" },
        { id: "x3", kind: "door_single", x: 4.095, y: 1.365, along: "h", width: 0.78, hinge: "end", swing: "plus" },
        { id: "x4", kind: "door_single", x: 2.275, y: 4.095, along: "h", width: 0.78, hinge: "start", swing: "plus" },
        { id: "x5", kind: "sliding_single", x: 3.64, y: 4.095, along: "h", width: 1.644 },
        { id: "x6", kind: "door_single", x: 4.095, y: 5.46, along: "h", width: 0.78, hinge: "start", swing: "plus" },
        { id: "x7", kind: "door_single", x: 5.46, y: 0.455, along: "v", width: 0.78, hinge: "start", swing: "minus" },
        { id: "x8", kind: "window", x: 0.91, y: 6.825, along: "h", width: 1.69 },
        { id: "x9", kind: "window", x: 0, y: 4.55, along: "v", width: 1.69 },
        { id: "x10", kind: "window_small", x: 4.095, y: 6.825, along: "h", width: 0.64 },
      ],
    },
    {
      level: 2,
      rooms: [
        { id: "r21", name: "LDK", type: "ldk", x: 0, y: 0, w: 5.46, d: 6.825 },
        { id: "r22", name: "パントリー", type: "storage", x: 5.46, y: 0, w: 1.82, d: 1.82 },
        { id: "r23", name: "階段", type: "stairs", x: 5.46, y: 1.82, w: 1.82, d: 1.82, dir: "up", stairKind: "u_turn", turn: "left" },
        { id: "r24", name: "スタディ", type: "study", x: 5.46, y: 3.64, w: 1.82, d: 1.82 },
        { id: "r25", name: "バルコニー", type: "balcony", x: 5.46, y: 5.46, w: 1.82, d: 1.365 },
      ],
      fixtures: [
        { id: "y1", kind: "window_terrace", x: 0.91, y: 0, along: "h", width: 1.69 },
        { id: "y2", kind: "window", x: 3.185, y: 0, along: "h", width: 1.69 },
        { id: "y3", kind: "window_terrace", x: 0, y: 2.275, along: "v", width: 1.69 },
        { id: "y4", kind: "window", x: 0.91, y: 6.825, along: "h", width: 1.69 },
        { id: "y5", kind: "window_terrace", x: 5.46, y: 5.46, along: "h", width: 1.69 },
        { id: "y6", kind: "sliding_single", x: 5.46, y: 3.64, along: "v", width: 1.644 },
      ],
    },
    {
      level: 3,
      rooms: [
        { id: "r31", name: "洋室", type: "bedroom", x: 0, y: 0, w: 3.64, d: 3.64 },
        { id: "r32", name: "廊下", type: "hall", x: 3.64, y: 0, w: 1.82, d: 3.64 },
        { id: "r33", name: "トイレ", type: "toilet", x: 5.46, y: 0, w: 0.91, d: 1.82 },
        { id: "r34", name: "収納", type: "closet", x: 6.37, y: 0, w: 0.91, d: 1.82 },
        { id: "r35", name: "階段", type: "stairs", x: 5.46, y: 1.82, w: 1.82, d: 1.82, dir: "up", stairKind: "u_turn", turn: "left" },
        { id: "r36", name: "洋室", type: "bedroom", x: 0, y: 3.64, w: 3.64, d: 3.185 },
        { id: "r37", name: "洋室", type: "bedroom", x: 3.64, y: 3.64, w: 3.64, d: 3.185 },
      ],
      fixtures: [
        { id: "z1", kind: "window", x: 0.91, y: 0, along: "h", width: 1.69 },
        { id: "z2", kind: "window", x: 0.91, y: 6.825, along: "h", width: 1.69 },
        { id: "z3", kind: "window", x: 4.55, y: 6.825, along: "h", width: 1.69 },
        { id: "z4", kind: "door_single", x: 3.64, y: 1.365, along: "v", width: 0.78, hinge: "start", swing: "minus" },
        { id: "z5", kind: "door_single", x: 2.275, y: 3.64, along: "h", width: 0.78, hinge: "start", swing: "plus" },
        { id: "z6", kind: "door_single", x: 4.095, y: 3.64, along: "h", width: 0.78, hinge: "end", swing: "plus" },
        { id: "z7", kind: "door_single", x: 5.46, y: 0.455, along: "v", width: 0.78, hinge: "start", swing: "minus" },
      ],
    },
  ];
  const openings: Opening[] = [
    { id: "o1", face: "S", floor: 2, offset: 5.9, width: 0.4, height: 2.4, sill: 0.3, kind: "slit" },
  ];
  const project: Project = {
    name: "藤沢市鵠沼松が岡4丁目",
    address: "神奈川県藤沢市鵠沼松が岡4丁目",
    catchCopy: "海と街の心地よさを感じる、開放的な暮らし。",
    site: {
      points,
      edges: [
        { index: 0, length: 8.4 },
        { index: 1, length: 9.19 },
        { index: 2, length: 8.14 },
        { index: 3, length: 1.35 },
        { index: 4, length: 7.63, road: true, roadWidth: 4.0, roadLabel: "法42条1項1号 公道" },
        { index: 5, length: 0.42, note: "NTT柱有" },
      ],
      northDeg: 0,
      areaOverride: 79.43,
      coverageRatio: 80,
      farRatio: 300,
      setback: 0.6,
      fireproofException: false,
    },
    grid: { baseEdge: 4, u: 0.455, v: 0.91 },
    building: {
      x: 1.0,
      y: 0.8,
      w: 7.28,
      d: 6.825,
      rotDeg: 0,
      floors: 3,
      floorHeights: [2.3, 2.3, 2.2],
      foundation: 0.6,
      roof: "shed",
      roofHighSide: "N",
      roofPitchSun: 1.5,
      wallColor: "#1f2530",
      accentColor: "#a86b3c",
      wallLabel: "ガルバリウム鋼板 縦張り（黒・つや消し）",
      accentLabel: "木目調の軒天・玄関ドア",
      structureLabel: "木造3階建て",
    },
    floors,
    openings,
    updatedAt: new Date().toISOString(),
  };
  project.building = buildingFromGrid(project.site, project.grid, project.building.w, project.building.d, project.building);
  return project;
}

export function emptyProject(): Project {
  const p = sampleProject();
  const e: Project = {
    ...p,
    name: "新しい物件",
    address: "",
    catchCopy: "",
    site: {
      ...p.site,
      points: [
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
      ],
      edges: [
        { index: 0 },
        { index: 1 },
        { index: 2 },
        { index: 3, road: true, roadWidth: 4, roadLabel: "公道" },
      ],
      areaOverride: undefined,
    },
    grid: { baseEdge: 3, u: 0.91, v: 0.91 },
    building: { ...p.building, x: 0.91, y: 0.91, w: 6.37, d: 7.28, rotDeg: 0 },
    floors: [
      { level: 1, rooms: [] },
      { level: 2, rooms: [] },
      { level: 3, rooms: [] },
    ],
    openings: [],
  };
  e.building = buildingFromGrid(e.site, e.grid, e.building.w, e.building.d, e.building);
  return e;
}


/**
 * 教材1: 横浜市保土ケ谷区法泉3丁目（建売・イーカム設計）。
 * 出典: 地積測量図（令和7年1月4日、任意座標系、地積124.32㎡）と 建築概要・配置図／立面図（図面番号14192001）。
 * 敷地座標は配置図の「座標面積計算表」（01〜012、x=右、y=上）をそのまま使用。敷地面積 123.59㎡。
 * 真北は配置図の記載 8.69°（図の上から左回り＝反時計回りと判断【要確認】）。
 * 建物: 2階建て 5.46×8.645、切妻6寸、軒の出250、北側に母屋下がり910。最高高さ 7.798、最高軒高 6.040、1FL +581。
 * 設計事務所の判定: 建ぺい率 39.20%（≦50）、容積率 73.09%（≦100）、第一種高度斜線 クリア 0.070／0.252。
 */
export function lessonProject1(): Project {
  const raw: [number, number][] = [
    [0.0, 0.0], [7.716, -0.244], [7.522, -8.132], [19.101, -8.17], [19.073, -10.19], [13.925, -10.168],
    [13.925, -10.16], [7.381, -10.133], [7.38, -10.216], [6.201, -10.713], [3.997, -15.418], [0.0, -13.557],
  ];
  const points = raw.map(([x, y]) => ({ x, y: y + 15.418 }));
  const lens = [7.71, 7.89, 11.57, 2.01, 5.14, 0.008, 6.54, 0.08, 1.27, 5.19, 4.4, 13.55];
  const base = sampleProject();
  const p: Project = {
    ...base,
    name: "教材1 保土ケ谷区法泉3丁目",
    address: "神奈川県横浜市保土ケ谷区法泉三丁目211番228の一部",
    catchCopy: "",
    site: {
      points,
      edges: lens.map((l, i) => (i === 3 ? { index: i, length: l, road: true, roadWidth: 4.89, roadLabel: "法42条1項1号 市道今井第382号線" } : { index: i, length: l })),
      northDeg: 351.31,
      areaOverride: 123.59,
      coverageRatio: 50,
      farRatio: 100,
      setback: 0.5,
      fireproofException: false,
      roadLevelDiff: 3.9,
      cornerLot: false,
      heightRules: {
        zoneId: "1low",
        roadSlope: 1.25,
        roadApplyDist: 20,
        northEnabled: true,
        northBase: 5,
        northSlope: 1.25,
        neighborEnabled: false,
        neighborBase: 20,
        neighborSlope: 1.25,
        kodoEnabled: true,
        kodoPresetId: "yokohama-1",
        kodoSegs: [{ from: 0, upTo: null, base: 5, slope: 0.6 }],
        kodoAbsolute: 10,
        absoluteMax: 10,
        skyEnabled: true,
      },
    },
    grid: { baseEdge: 0, u: 1.25, v: 1.02 },
    building: {
      ...base.building,
      w: 5.46,
      d: 8.645,
      floors: 2,
      floorHeights: [2.4, 2.409],
      foundation: 0.481,
      roof: "gable",
      roofHighSide: "N",
      roofPitchSun: 6,
      eaveOverhang: 0.25,
      // 底辺（01→02＝敷地の北辺）を基準にしたので、建物座標の y=0 側が北。母屋下がりは局所座標の S 面
      roofDrop: { S: 0.91 },
      structureLabel: "木造2階建て",
      wallLabel: "軽量モルタル t=15 リシン吹付け",
      accentLabel: "彩色無石綿スレート葺き屋根",
    },
    floors: [
      { level: 1, rooms: [{ id: "L1", name: "1階（面積合わせ 46.02㎡）", type: "other", x: 0, y: 0, w: 5.46, d: 8.428 }], fixtures: [] },
      { level: 2, rooms: [{ id: "L2", name: "2階（面積合わせ 44.30㎡）", type: "other", x: 0, y: 0, w: 5.46, d: 8.114 }], fixtures: [] },
    ],
    openings: [],
    updatedAt: new Date().toISOString(),
  };
  p.building = buildingFromGrid(p.site, p.grid, p.building.w, p.building.d, p.building);
  return p;
}


/**
 * 教材2: 横浜市戸塚区深谷町（建売・イーカム設計、確定図 2025年6月19日）。測量図なし。
 * 敷地は配置図の求積表（Xn=南北, Yn=東西）から。敷地面積 110.50㎡。準住居地域・準防火・第4種高度地区・宅造規制区域。
 * 道路: 法42条1項5号（認定幅員4.5m）。敷地は北辺10.25mのうち東側4.25mだけ道路に接する。
 * 建物: 2階建て L形（建築面積54.33）。ここでは外接矩形 9.10×6.37 で近似。最高高さ 8.261、最高軒高 6.100、1FL +581。
 * 設計事務所の判定: 建ぺい率 49.17%（≦60）、容積率 90.67%（≦180、道路幅員 4.5×0.4）、道路斜線・高度斜線とも支障なし。
 * 真北は配置図の記載 33°（時計回りと判断【要確認】）。
 */
export function lessonProject2(): Project {
  // 求積表: 点名, Xn(北), Yn(東)。描画は x=Yn, y=Xn
  const raw: [string, number, number][] = [
    ["100", 294.455, 290.976], ["A19", 284.311, 293.376], ["A17-1", 285.012, 296.118], ["A25", 285.321, 299.282], ["A12", 285.798, 303.838], ["A9", 296.605, 301.004],
  ];
  const minX = Math.min(...raw.map((r) => r[2]));
  const minY = Math.min(...raw.map((r) => r[1]));
  const points = raw.map(([, X, Y]) => ({ x: +(Y - minX).toFixed(3), y: +(X - minY).toFixed(3) }));
  const lens = [10.42, 2.83, 3.18, 4.58, 11.17, 10.25];
  const base = sampleProject();
  const p: Project = {
    ...base,
    name: "教材2 戸塚区深谷町",
    address: "神奈川県横浜市戸塚区深谷町字谷中1528番6、1525番4",
    catchCopy: "",
    site: {
      points,
      edges: lens.map((l, i) => (i === 5 ? { index: i, length: l, road: true, roadWidth: 4.5, roadLabel: "法42条1項5号（認定幅員4.5m）接道4.25m", note: "隣地6.00＋道路4.25" } : { index: i, length: l })),
      northDeg: 33,
      areaOverride: 110.5,
      coverageRatio: 60,
      farRatio: 200,
      setback: 0.5,
      fireproofException: false,
      roadLevelDiff: 0,
      cornerLot: false,
      heightRules: {
        zoneId: "quasi",
        roadSlope: 1.25,
        roadApplyDist: 20,
        northEnabled: false,
        northBase: 5,
        northSlope: 1.25,
        neighborEnabled: true,
        neighborBase: 20,
        neighborSlope: 1.25,
        kodoEnabled: true,
        kodoPresetId: "yokohama-4",
        kodoSegs: [],
        kodoAbsolute: 0,
        absoluteMax: 0,
        skyEnabled: true,
      },
    },
    grid: { baseEdge: 5, u: 0.62, v: 2.35 },
    building: {
      ...base.building,
      w: 9.1,
      d: 6.37,
      floors: 2,
      floorHeights: [2.4, 2.469],
      foundation: 0.481,
      roof: "gable",
      roofHighSide: "E",
      roofPitchSun: 6,
      eaveOverhang: 0.25,
      roofDrop: {},
      structureLabel: "木造2階建て",
      wallLabel: "T1000 ソフトリシン吹付",
      accentLabel: "カパラスKS40 フレッシュグリーンII 屋根",
    },
    floors: [
      { level: 1, rooms: [{ id: "L1", name: "1階（面積合わせ 53.82㎡）", type: "other", x: 0, y: 0, w: 9.1, d: 5.914 }], fixtures: [] },
      { level: 2, rooms: [{ id: "L2", name: "2階（面積合わせ 46.37㎡）", type: "other", x: 0, y: 0, w: 9.1, d: 5.096 }], fixtures: [] },
    ],
    openings: [],
    updatedAt: new Date().toISOString(),
  };
  p.building = buildingFromGrid(p.site, p.grid, p.building.w, p.building.d, p.building);
  return p;
}


/**
 * 教材3（検証用・架空）: 教材2の敷地に木造3階建てを置き、道路斜線を天空率でかわす例。
 * 実在の設計図ではなく、天空率・日影・L字形・寄棟の動作を確かめるための架空の計画。
 * 準住居地域・道路 4.5m・日影 4m 測定面 4h/2.5h（教材2の都市計画図の「日影」欄と同じ）。
 */
export function lessonProject3(): Project {
  const p = lessonProject2();
  p.name = "教材3 検証用 3階建て（架空）";
  p.catchCopy = "教材2の敷地で、道路斜線を天空率でかわす3階建て（架空の検証用）";
  p.site.heightRules = { ...(p.site.heightRules ?? DEFAULT_HEIGHT_RULES), kodoEnabled: false, kodoPresetId: "", kodoSegs: [], kodoAbsolute: 0, shadowEnabled: true, shadowTarget: "h10", shadowPlaneH: 4, shadowHours5: 4, shadowHours10: 2.5, latitude: 35.45 };
  p.grid = { baseEdge: 5, u: 0.62, v: 1.0 };
  p.building = buildingFromGrid(p.site, p.grid, 8.19, 6.37, {
    ...p.building,
    w: 8.19,
    d: 6.37,
    floors: 3,
    floorHeights: [2.4, 2.4, 2.4],
    foundation: 0.5,
    roof: "hip",
    roofHighSide: "E",
    roofPitchSun: 4,
    eaveOverhang: 0.45,
    roofDrop: {},
    notches: [{ corner: "NW", w: 1.82, d: 1.82 }],
    structureLabel: "木造3階建て（架空）",
  });
  p.floors = [
    { level: 1, rooms: [{ id: "L1a", name: "1階", type: "other", x: 0, y: 0, w: 8.19, d: 4.55 }, { id: "L1b", name: "1階（奥）", type: "other", x: 1.82, y: 4.55, w: 6.37, d: 1.82 }], fixtures: [] },
    { level: 2, rooms: [{ id: "L2a", name: "2階", type: "other", x: 0, y: 0, w: 8.19, d: 4.55 }, { id: "L2b", name: "2階（奥）", type: "other", x: 1.82, y: 4.55, w: 6.37, d: 1.82 }], fixtures: [] },
    { level: 3, rooms: [{ id: "L3", name: "3階", type: "other", x: 0, y: 0, w: 8.19, d: 4.55 }], fixtures: [] },
  ];
  return p;
}
