import type { Project, Floor, Opening } from "./types";
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
