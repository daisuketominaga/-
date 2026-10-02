/**
 * 図面出力（間取り図シート）の純粋な計算部分。React を使わない。
 * A4 横 1 枚に全階（1F・2F…）を並べ、面積表・定型注記・発行者を付ける。
 * 画面（PlanSheetPanel）・PNG・印刷 PDF・CLI（planSvg.ts）はすべてこのレイアウトを使う。
 */
import type { Project, Floor, FurnitureItem } from "./types";
import { TSUBO_M2 } from "./types";
import { round, footprintArea, floorAreaOf, siteAreaOf } from "./geometry";
import { wallThickness } from "./walls";
import { autoFurniture } from "./furniture";

/** 図面に必ず入れる定型注記（2026-10-02 富永承認） */
export const PLAN_NOTES: readonly string[] = [
  "寸法は壁芯（壁の中心線）です。壁の厚みは見え方のための仮の値で、面積は壁芯の概算です。",
  "家具は配置イメージです。実寸の簡易図形で、実際の家具・配置とは異なります。",
  "参考プラン（建築確認未取得）です。建築には別途設計・建築確認が必要です。",
];

/** A4 横を 96dpi で描いたときの大きさ（px）。印刷時は @page で A4 横に合わせる */
export const A4_LANDSCAPE = { W: 1123, H: 794 };

export type PlanSheetOptions = {
  /** 描く階（未指定なら全階） */
  levels?: number[];
  /** 家具を描く（既定 true） */
  furniture?: boolean;
  /** 作成日の表示（YYYY-MM-DD）。未指定なら今日 */
  date?: string;
  /** 発行者 */
  company?: string;
};

export type PlanSheetCell = {
  floor: Floor;
  level: number;
  /** セルの位置と大きさ（px） */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 図の縮尺（px / m）と原点（建物左下のスクリーン位置の基準。PlanParts の ox/oy と同じ意味） */
  px: number;
  ox: number;
  oy: number;
  compact: boolean;
  areaM2: number;
  balconyM2: number;
  title: string;
  furniture: FurnitureItem[];
  /** 自動配置で入らなかった家具 */
  skipped: { room: string; kind: string }[];
};

export type PlanSheetLayout = {
  W: number;
  H: number;
  margin: number;
  title: string;
  subtitle: string;
  cells: PlanSheetCell[];
  table: [string, string][];
  notes: string[];
  footer: string;
  bandY: number;
};

/** 「3LDK＋ガレージ」のような間取りの要約 */
export function summaryOf(project: Project): string {
  const rooms = project.floors.flatMap((f) => f.rooms);
  const bedrooms = rooms.filter((r) => r.type === "bedroom" || r.type === "japanese").length;
  const hasLdk = rooms.some((r) => r.type === "ldk");
  const extras = Array.from(new Set(rooms.filter((r) => r.type === "study" || r.type === "garage").map((r) => r.name)));
  return `${bedrooms}${hasLdk ? "LDK" : "K"}${extras.length ? "＋" + extras.join("＋") : ""}`;
}

const balconyAreaOf = (f: Floor) => f.rooms.filter((r) => r.type === "balcony").reduce((a, r) => a + r.w * r.d, 0);

/** 家具の id を決まった順で振る（出力が毎回同じになるように） */
function seqId(prefix: string) {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export function planSheetLayout(project: Project, opts: PlanSheetOptions = {}): PlanSheetLayout {
  const b = project.building;
  const { W, H } = A4_LANDSCAPE;
  const margin = 28;
  const headerH = 50;
  const bandH = 150; // 下段: 面積表（2 列）・注記
  const gap = 12;
  const floors = project.floors.filter((f) => !opts.levels || opts.levels.includes(f.level)).sort((p, q) => p.level - q.level);
  const n = Math.max(1, floors.length);
  const cellW = (W - margin * 2 - gap * (n - 1)) / n;
  const cellY = margin + headerH;
  const cellH = H - margin * 2 - headerH - bandH - gap;
  // 図の余白: 左に寸法線 2 段（約 70px）、上に寸法線 2 段（約 70px）、右と下は少し
  const padL = 72, padT = 74, padR = 24, padB = 20, titleH = 24;
  const cells: PlanSheetCell[] = floors.map((f, i) => {
    const x = margin + i * (cellW + gap);
    const drawW = cellW - padL - padR;
    const drawH = cellH - titleH - padT - padB;
    const px = Math.max(10, Math.min(60, drawW / b.w, drawH / b.d));
    const ox = x + padL + (drawW - b.w * px) / 2;
    const oy = cellY + titleH + padT + (drawH - b.d * px) / 2;
    const areaM2 = floorAreaOf(b, f.rooms);
    const balconyM2 = balconyAreaOf(f);
    const furn = opts.furniture === false ? { items: [], skipped: [] } : autoFurniture(b, f.rooms, f.fixtures ?? [], seqId(`f${f.level}-`));
    return {
      floor: f,
      level: f.level,
      x,
      y: cellY,
      w: cellW,
      h: cellH,
      px,
      ox,
      oy,
      compact: px < 36,
      areaM2,
      balconyM2,
      title: `${f.level}階　床面積 ${round(areaM2, 2).toFixed(2)}㎡（${round(areaM2 / TSUBO_M2, 2).toFixed(2)}坪）${balconyM2 ? `　バルコニー ${round(balconyM2, 2).toFixed(2)}㎡ 別` : ""}`,
      furniture: furn.items,
      skipped: furn.skipped,
    };
  });
  const total = project.floors.reduce((a, f) => a + floorAreaOf(b, f.rooms), 0);
  const siteArea = siteAreaOf(project.site);
  const wt = wallThickness(b);
  const table: [string, string][] = [
    ["間取り", summaryOf(project)],
    ["敷地面積", siteArea ? `${round(siteArea, 2).toFixed(2)}㎡（${round(siteArea / TSUBO_M2, 2).toFixed(2)}坪）` : "－"],
    ["建築面積", `${round(footprintArea(b), 2).toFixed(2)}㎡`],
    ...project.floors.map((f) => [`${f.level}階 床面積`, `${round(floorAreaOf(b, f.rooms), 2).toFixed(2)}㎡${balconyAreaOf(f) ? `（＋バルコニー ${round(balconyAreaOf(f), 2).toFixed(2)}㎡）` : ""}`] as [string, string]),
    ["延床面積", `${round(total, 2).toFixed(2)}㎡（${round(total / TSUBO_M2, 2).toFixed(2)}坪）`],
    ["構造・階数", b.structureLabel || "－"],
    ["壁厚（図示用・仮）", `外壁 ${Math.round(wt.ext * 1000)}mm／内壁 ${Math.round(wt.int * 1000)}mm`],
  ];
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const company = opts.company ?? "株式会社イチエン不動産";
  return {
    W,
    H,
    margin,
    title: `${project.name}　間取り図（参考プラン）`,
    subtitle: [project.address, b.structureLabel].filter(Boolean).join("　"),
    cells,
    table,
    notes: [...PLAN_NOTES],
    footer: `${company}　作成日 ${date}　イチエン物件ビジュアル工房`,
    bandY: H - margin - bandH,
  };
}
