import type { Building, Room, FixtureKind } from "./types";
import { footprintPolygon } from "./geometry";
import { roomGroups, groupOutline } from "./roomGroups";

/** 壁線。部屋の座標は壁芯なので、壁はこの線を中心に厚みを持つ */
export type Wall = { x1: number; y1: number; x2: number; y2: number; along: "h" | "v"; outer: boolean };

/** 外壁にしか置けない建具 */
export const EXTERIOR_ONLY: FixtureKind[] = ["window", "window_terrace", "window_small", "door_entrance", "door_parent_child"];
/** 開き戸（吊元・開く側を持つ） */
export const DOOR_KINDS: FixtureKind[] = ["door_single", "door_entrance", "door_parent_child"];

/**
 * 壁厚の既定値（m）。【仮置き】建築士の確認前の目安で、物件ごとに Building.wallExt / wallInt で上書きできる。
 * 木造在来（柱 105mm）での一般的な構成の例:
 *   内壁 105 ＋ 石膏ボード 12.5×2 ≒ 130mm、外壁 サイディング＋通気層＋柱 105＋内側ボード ≒ 150〜165mm
 *   （出典: 住まいのサポナビ「壁の厚さが決め手」 https://housing-solution.jp/exterior/exterior-wall-repair/wall-thickness/ 、
 *     ハウ・ツゥ・ライブ「お気に入りの家具がちゃんと収まりますか？」 https://how2live.co.jp/9058/ 、2026-10-02 確認）
 * 図面には「寸法は壁芯」と明記し、壁厚は見え方のためだけに使う（面積計算には使わない）。
 */
export const DEFAULT_WALL_EXT = 0.15;
export const DEFAULT_WALL_INT = 0.13;

export function wallThickness(b: Pick<Building, "wallExt" | "wallInt">): { ext: number; int: number } {
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0.02 && v < 0.6;
  return { ext: ok(b.wallExt) ? (b.wallExt as number) : DEFAULT_WALL_EXT, int: ok(b.wallInt) ? (b.wallInt as number) : DEFAULT_WALL_INT };
}

/** 外壁と部屋の境界線を壁の候補として集める */
export function wallSegments(b: Building, rooms: Room[]): Wall[] {
  // 外壁 = 外形（切り欠き後）の各辺
  const poly = footprintPolygon(b);
  const walls: Wall[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    if (Math.abs(a.y - c.y) < 1e-9) walls.push({ x1: Math.min(a.x, c.x), y1: a.y, x2: Math.max(a.x, c.x), y2: a.y, along: "h", outer: true });
    else walls.push({ x1: a.x, y1: Math.min(a.y, c.y), x2: a.x, y2: Math.max(a.y, c.y), along: "v", outer: true });
  }
  const eps = 1e-6;
  const onOuter = (e: Wall) => walls.some((w) => w.outer && w.along === e.along && (e.along === "h" ? Math.abs(w.y1 - e.y1) < eps && e.x1 >= w.x1 - eps && e.x2 <= w.x2 + eps : Math.abs(w.x1 - e.x1) < eps && e.y1 >= w.y1 - eps && e.y2 <= w.y2 + eps));
  // 同じ名前でつながった部屋（L 字の LDK など）の内側には壁を作らない
  for (const g of roomGroups(rooms.filter((r) => r.type !== "balcony"))) {
    for (const e of groupOutline(g)) if (!onOuter({ ...e, outer: false })) walls.push({ ...e, outer: false });
  }
  return walls;
}

/** 建具がその壁線（外壁か内壁か）の上にあるか。外壁なら true、内壁なら false、どの壁にも無ければ null */
export function fixtureOnOuterWall(b: Building, rooms: Room[], fx: { x: number; y: number; along: "h" | "v"; width: number }): boolean | null {
  const eps = 1e-6;
  let found: boolean | null = null;
  for (const w of wallSegments(b, rooms)) {
    if (w.along !== fx.along) continue;
    const on = w.along === "h" ? Math.abs(w.y1 - fx.y) < eps && fx.x >= w.x1 - eps && fx.x + fx.width <= w.x2 + eps : Math.abs(w.x1 - fx.x) < eps && fx.y >= w.y1 - eps && fx.y + fx.width <= w.y2 + eps;
    if (!on) continue;
    if (w.outer) return true;
    found = false;
  }
  return found;
}
