import type { Pt, Site, GridSetting, Building } from "./types";
import { HALF, MODULE } from "./types";
import { pointInPolygon, insetPolygon, round } from "./geometry";

/** 底辺の枠組み: 始点 a、辺に沿った単位ベクトル t、内側向きの単位法線 n */
export type Frame = { a: Pt; t: Pt; n: Pt; len: number; reversed: boolean };

/** 選んだ辺を底辺として、内側が「上」になる座標系を作る */
export function baseFrame(site: Site, edgeIndex: number): Frame {
  const n = site.points.length;
  const i = ((edgeIndex % n) + n) % n;
  let a = site.points[i];
  let b = site.points[(i + 1) % n];
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let len = Math.hypot(dx, dy) || 1;
  let t = { x: dx / len, y: dy / len };
  // 左法線
  let nrm = { x: -t.y, y: t.x };
  const mid = { x: (a.x + b.x) / 2 + nrm.x * 0.05, y: (a.y + b.y) / 2 + nrm.y * 0.05 };
  let reversed = false;
  if (!pointInPolygon(mid, site.points)) {
    // 左法線が外側なら、辺を逆向きにたどる
    [a, b] = [b, a];
    dx = b.x - a.x;
    dy = b.y - a.y;
    len = Math.hypot(dx, dy) || 1;
    t = { x: dx / len, y: dy / len };
    nrm = { x: -t.y, y: t.x };
    reversed = true;
  }
  return { a, t, n: nrm, len, reversed };
}

/** 世界座標 → 底辺座標 (u: 辺に沿って, v: 内側へ) */
export function toLocal(f: Frame, p: Pt): Pt {
  const dx = p.x - f.a.x;
  const dy = p.y - f.a.y;
  return { x: dx * f.t.x + dy * f.t.y, y: dx * f.n.x + dy * f.n.y };
}

export function toWorld(f: Frame, l: Pt): Pt {
  return { x: f.a.x + l.x * f.t.x + l.y * f.n.x, y: f.a.y + l.x * f.t.y + l.y * f.n.y };
}

export const snapHalf = (v: number) => round(Math.round(v / HALF) * HALF, 3);

/** 底辺基準の位置と大きさから、世界座標の建物（x, y, rotDeg）を作る */
export function buildingFromGrid(site: Site, g: GridSetting, w: number, d: number, prev: Building): Building {
  const f = baseFrame(site, g.baseEdge);
  const origin = toWorld(f, { x: g.u, y: g.v });
  const rotDeg = (Math.atan2(f.t.y, f.t.x) * 180) / Math.PI;
  return { ...prev, x: round(origin.x, 3), y: round(origin.y, 3), w: round(w, 3), d: round(d, 3), rotDeg: round(rotDeg, 2) };
}

/** 矩形（底辺座標）が離れ線の内側に収まるか（4隅と辺の中点で判定） */
export function rectFits(f: Frame, inner: Pt[], u: number, v: number, w: number, d: number) {
  const pts: Pt[] = [
    { x: u, y: v },
    { x: u + w, y: v },
    { x: u + w, y: v + d },
    { x: u, y: v + d },
    { x: u + w / 2, y: v },
    { x: u + w / 2, y: v + d },
    { x: u, y: v + d / 2 },
    { x: u + w, y: v + d / 2 },
  ];
  return pts.every((p) => pointInPolygon(toWorld(f, p), inner));
}

/** 離れ線の内側に入る、455mm刻みで最大の矩形を探す */
export function maxRect(site: Site, edgeIndex: number, setback: number) {
  const f = baseFrame(site, edgeIndex);
  const inner = setback > 0 ? insetPolygon(site.points, setback) : site.points;
  const loc = site.points.map((p) => toLocal(f, p));
  const minU = Math.floor(Math.min(...loc.map((p) => p.x)) / HALF) * HALF;
  const maxU = Math.max(...loc.map((p) => p.x));
  const maxV = Math.max(...loc.map((p) => p.y));
  let best = { u: 0, v: 0, w: 0, d: 0, area: 0 };
  for (let u = minU; u < maxU; u += HALF) {
    for (let v = 0; v < maxV; v += HALF) {
      if (!rectFits(f, inner, u, v, HALF, HALF)) continue;
      // 幅を伸ばせるだけ伸ばし、各幅で奥行を最大化
      for (let w = HALF; u + w <= maxU + 1e-9; w += HALF) {
        if (!rectFits(f, inner, u, v, w, HALF)) break;
        let d = HALF;
        while (v + d + HALF <= maxV + 1e-9 && rectFits(f, inner, u, v, w, d + HALF)) d += HALF;
        const area = w * d;
        if (area > best.area) best = { u: round(u, 3), v: round(v, 3), w: round(w, 3), d: round(d, 3), area };
      }
    }
  }
  return best;
}

export const modules = (m: number) => round(m / MODULE, 2);
