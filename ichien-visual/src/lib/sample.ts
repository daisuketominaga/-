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
  const floors: Floor[] = [
    {
      level: 1,
      rooms: [
        { id: "r1", name: "ガレージ", type: "garage", x: 0, y: 0, w: 3.4, d: 3.2 },
        { id: "r2", name: "玄関", type: "entrance", x: 0, y: 3.2, w: 1.4, d: 1.6 },
        { id: "r3", name: "廊下", type: "hall", x: 1.4, y: 3.2, w: 3.6, d: 1.0 },
        { id: "r4", name: "トイレ", type: "toilet", x: 3.4, y: 2.2, w: 1.0, d: 1.0 },
        { id: "r5", name: "洗面・脱衣室", type: "washroom", x: 4.4, y: 1.6, w: 1.8, d: 1.6 },
        { id: "r6", name: "浴室", type: "bath", x: 4.4, y: 0, w: 1.8, d: 1.6 },
        { id: "r7", name: "階段", type: "stairs", x: 0, y: 4.8, w: 1.4, d: 2.0 },
        { id: "r8", name: "WCL", type: "closet", x: 0, y: 6.8, w: 1.4, d: 1.5 },
        { id: "r9", name: "洋室", type: "bedroom", x: 1.4, y: 4.2, w: 3.8, d: 4.1 },
        { id: "r10", name: "収納", type: "closet", x: 5.2, y: 4.2, w: 1.0, d: 1.2 },
      ],
    },
    {
      level: 2,
      rooms: [
        { id: "r21", name: "階段", type: "stairs", x: 0, y: 4.8, w: 1.4, d: 2.0 },
        { id: "r22", name: "パントリー", type: "storage", x: 0, y: 6.8, w: 1.4, d: 1.5 },
        { id: "r23", name: "LDK", type: "ldk", x: 1.4, y: 0, w: 4.8, d: 8.3 },
        { id: "r24", name: "バルコニー", type: "balcony", x: 0, y: 0, w: 1.4, d: 2.6 },
        { id: "r25", name: "スタディ", type: "study", x: 4.8, y: 6.8, w: 1.4, d: 1.5 },
      ],
    },
    {
      level: 3,
      rooms: [
        { id: "r31", name: "階段", type: "stairs", x: 0, y: 4.8, w: 1.4, d: 2.0 },
        { id: "r32", name: "WCL", type: "closet", x: 0, y: 6.8, w: 1.4, d: 1.5 },
        { id: "r33", name: "洋室", type: "bedroom", x: 1.4, y: 4.4, w: 4.8, d: 3.9 },
        { id: "r34", name: "廊下", type: "hall", x: 1.4, y: 3.4, w: 3.6, d: 1.0 },
        { id: "r35", name: "トイレ", type: "toilet", x: 5.0, y: 3.4, w: 1.2, d: 1.0 },
        { id: "r36", name: "洋室", type: "bedroom", x: 0, y: 0, w: 3.1, d: 3.4 },
        { id: "r37", name: "洋室", type: "bedroom", x: 3.1, y: 0, w: 3.1, d: 3.4 },
      ],
    },
  ];
  const openings: Opening[] = [
    { id: "o1", face: "S", floor: 1, offset: 0.4, width: 2.6, height: 2.2, sill: 0, kind: "garage" },
    { id: "o2", face: "S", floor: 1, offset: 3.6, width: 0.9, height: 2.2, sill: 0, kind: "door" },
    { id: "o3", face: "S", floor: 2, offset: 2.0, width: 0.4, height: 2.4, sill: 0.3, kind: "slit" },
    { id: "o4", face: "E", floor: 2, offset: 0.3, width: 2.4, height: 2.0, sill: 0.2, kind: "window" },
    { id: "o5", face: "E", floor: 2, offset: 3.4, width: 1.8, height: 1.6, sill: 0.8, kind: "window" },
    { id: "o6", face: "E", floor: 3, offset: 0.5, width: 1.6, height: 1.2, sill: 0.9, kind: "window" },
    { id: "o7", face: "E", floor: 3, offset: 3.6, width: 1.6, height: 1.2, sill: 0.9, kind: "window" },
    { id: "o8", face: "N", floor: 1, offset: 1.0, width: 0.6, height: 0.6, sill: 1.5, kind: "window" },
    { id: "o9", face: "N", floor: 2, offset: 3.0, width: 1.6, height: 2.0, sill: 0.2, kind: "window" },
    { id: "o10", face: "N", floor: 3, offset: 6.0, width: 1.4, height: 1.2, sill: 0.9, kind: "window" },
    { id: "o11", face: "W", floor: 1, offset: 4.2, width: 1.2, height: 1.0, sill: 1.0, kind: "window" },
    { id: "o12", face: "W", floor: 3, offset: 1.2, width: 1.6, height: 1.2, sill: 0.9, kind: "window" },
  ];
  const sx = 7.28 / 6.2;
  const sy = 6.825 / 8.3;
  const r2 = (v: number) => Math.round(Math.round(v / 0.455) * 0.455 * 1000) / 1000;
  for (const f of floors) {
    f.rooms = f.rooms.map((r) => ({ ...r, x: r2(r.x * sx), y: r2(r.y * sy), w: r2(r.w * sx), d: r2(r.d * sy) }));
  }
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
