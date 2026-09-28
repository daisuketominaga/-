import type { Pt, Site, GridSetting, Building } from "./types";
import { HALF, MODULE } from "./types";
import { pointInPolygon, insetPolygon, round, dist, footprintPolygon } from "./geometry";
import type { Notch } from "./types";

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

/** 半直線 (o + s*dir, s>0) と線分 a-b の交点までの距離 */
function rayToSegment(o: Pt, dir: Pt, a: Pt, b: Pt): number | null {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const det = dir.x * ey - dir.y * ex;
  if (Math.abs(det) < 1e-9) return null;
  const dx = a.x - o.x;
  const dy = a.y - o.y;
  const s = (dx * ey - dy * ex) / det;
  const t = (dx * dir.y - dy * dir.x) / det;
  if (s <= 1e-9 || t < -1e-9 || t > 1 + 1e-9) return null;
  return s;
}

export type Clearances = { bottom: number | null; top: number | null; left: number | null; right: number | null };

/** 建物の各辺の中点から、外向きに境界線までの距離（底辺座標）。bottom が底辺側 */
export function clearances(site: Site, g: GridSetting, w: number, d: number): Clearances {
  const f = baseFrame(site, g.baseEdge);
  const loc = site.points.map((p) => toLocal(f, p));
  const n = loc.length;
  const cast = (o: Pt, dir: Pt) => {
    let best: number | null = null;
    for (let i = 0; i < n; i++) {
      const s = rayToSegment(o, dir, loc[i], loc[(i + 1) % n]);
      if (s !== null && (best === null || s < best)) best = s;
    }
    return best;
  };
  const u = g.u;
  const v = g.v;
  return {
    bottom: cast({ x: u + w / 2, y: v }, { x: 0, y: -1 }),
    top: cast({ x: u + w / 2, y: v + d }, { x: 0, y: 1 }),
    left: cast({ x: u, y: v + d / 2 }, { x: -1, y: 0 }),
    right: cast({ x: u + w, y: v + d / 2 }, { x: 1, y: 0 }),
  };
}


export type RoadBand = { poly: Pt[]; mid: Pt; w: number; label: string };

/** 道路帯（底辺座標）。辺の外側へ幅員ぶん広げた帯 */
export function roadBands(site: Site, f: Frame, ext = 6): RoadBand[] {
  const cx = site.points.reduce((s, p) => s + p.x, 0) / site.points.length;
  const cy = site.points.reduce((s, p) => s + p.y, 0) / site.points.length;
  return site.edges
    .filter((e) => e.road && e.index < site.points.length)
    .map((e) => {
      const a = site.points[e.index];
      const b = site.points[(e.index + 1) % site.points.length];
      const w = e.roadWidth ?? 4;
      const dx = (b.x - a.x) / (dist(a, b) || 1);
      const dy = (b.y - a.y) / (dist(a, b) || 1);
      let nx = dy, ny = -dx;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if ((mx + nx - cx) ** 2 + (my + ny - cy) ** 2 < (mx - cx) ** 2 + (my - cy) ** 2) { nx = -nx; ny = -ny; }
      const poly = [
        { x: a.x - dx * ext, y: a.y - dy * ext },
        { x: b.x + dx * ext, y: b.y + dy * ext },
        { x: b.x + dx * ext + nx * w, y: b.y + dy * ext + ny * w },
        { x: a.x - dx * ext + nx * w, y: a.y - dy * ext + ny * w },
      ].map((p) => toLocal(f, p));
      const mid = toLocal(f, { x: mx + nx * (w / 2), y: my + ny * (w / 2) });
      return { poly, mid, w, label: e.roadLabel ?? "公道" };
    });
}

export type SiteContext = { site: Pt[]; setback: Pt[]; roads: RoadBand[] };

/** 敷地・離れ線・道路を「建物の左下を原点にした建物座標（m）」で返す。間取り図の背景用 */
export function siteInBuildingFrame(site: Site, g: GridSetting, setback: number): SiteContext {
  const f = baseFrame(site, g.baseEdge);
  const shift = (p: Pt) => ({ x: p.x - g.u, y: p.y - g.v });
  const inner = setback > 0 ? insetPolygon(site.points, setback) : site.points;
  return {
    site: site.points.map((p) => shift(toLocal(f, p))),
    setback: inner.map((p) => shift(toLocal(f, p))),
    roads: roadBands(site, f, 3).map((r) => ({ ...r, poly: r.poly.map(shift), mid: shift(r.mid) })),
  };
}


/** 外形（切り欠き後）の頂点と各辺の中点が、離れ線の内側にあるか */
export function footprintFits(f: Frame, inner: Pt[], g: GridSetting, b: Building): boolean {
  const poly = footprintPolygon(b);
  // 頂点・辺の中点を、建物の中心へごくわずか（0.1mm）寄せてから判定（離れ線にぴったり揃えた辺を内側と扱う）
  const cx = b.w / 2, cy = b.d / 2, E = 1e-4;
  const nudge = (p: Pt): Pt => { const dx = cx - p.x, dy = cy - p.y, l = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / l) * E, y: p.y + (dy / l) * E }; };
  const pts: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    pts.push(nudge(a), nudge({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }));
  }
  return pts.every((p) => pointInPolygon(toWorld(f, { x: g.u + p.x, y: g.v + p.y }), inner));
}

export type StairResult = { u: number; v: number; w: number; d: number; notches: Notch[]; area: number; cells: number };

/**
 * 底辺（基準の辺）から setback だけ内側の線に建物の底辺を揃え、455mm のマス目で離れ線の内側に
 * 完全に入るマスをすべて拾って、階段状の最大範囲を作る。
 * 結果は「外接する枠 ＋ 角ごとの切り欠き（複数）」で表す。左右の輪郭が凸でない敷地では、
 * 角の切り欠きで表せる形（各辺の輪郭が単調な階段）になるようマスを減らす（安全側）。
 * u0: 底辺に沿ったマス目の原点（この値の倍数位置にマスの境界が来る）。v は setback に固定。
 */
export function maxStair(site: Site, edgeIndex: number, setback: number, u0 = 0): StairResult {
  const f = baseFrame(site, edgeIndex);
  const inner = setback > 0 ? insetPolygon(site.points, setback) : site.points;
  const loc = site.points.map((p) => toLocal(f, p));
  const minU = Math.floor((Math.min(...loc.map((p) => p.x)) - u0) / HALF) * HALF + u0;
  const maxU = Math.max(...loc.map((p) => p.x));
  const maxV = Math.max(...loc.map((p) => p.y));
  const v0 = setback;
  // 離れ線にぴったり乗る点は「内側」とみなしたいので、判定点はマスの内側へごくわずかに寄せる
  const E = 1e-4;
  const cellIn = (u: number, v: number) => {
    const u0 = u + E, u1 = u + HALF - E, w0 = v + E, w1 = v + HALF - E;
    const pts: Pt[] = [
      { x: u0, y: w0 }, { x: u1, y: w0 }, { x: u1, y: w1 }, { x: u0, y: w1 },
      { x: (u0 + u1) / 2, y: w0 }, { x: (u0 + u1) / 2, y: w1 }, { x: u0, y: (w0 + w1) / 2 }, { x: u1, y: (w0 + w1) / 2 },
    ];
    return pts.every((p) => pointInPolygon(toWorld(f, p), inner));
  };
  const cols = Math.ceil((maxU - minU) / HALF) + 1;
  const rows = Math.ceil((maxV - v0) / HALF) + 1;
  // 行ごとの「入っているマス」の最長の連続区間 [L_j, R_j]（列番号）
  const L: number[] = [], R: number[] = [];
  for (let j = 0; j < rows; j++) {
    let bestL = -1, bestR = -2, curL = -1;
    for (let i = 0; i <= cols; i++) {
      const ok = i < cols && cellIn(minU + i * HALF, v0 + j * HALF);
      if (ok && curL < 0) curL = i;
      if (!ok && curL >= 0) { if (i - 1 - curL > bestR - bestL) { bestL = curL; bestR = i - 1; } curL = -1; }
    }
    L.push(bestL); R.push(bestR);
  }
  // 底辺側から連続して入る行だけ使う（途中で切れたらそこまで）
  let nRows = 0;
  while (nRows < rows && L[nRows] >= 0) nRows++;
  if (nRows === 0) return { u: 0, v: v0, w: 0, d: 0, notches: [], area: 0, cells: 0 };
  const Ls = L.slice(0, nRows), Rs = R.slice(0, nRows);
  // 左の輪郭を「最も左に出る行 j* まで単調に広がり、その先は単調に狭まる」形に丸める（マスを減らす方向）
  const mono = (arr: number[], better: (a: number, b: number) => boolean) => {
    const best = arr.reduce((bi, v, i) => (better(v, arr[bi]) ? i : bi), 0);
    const out = [...arr];
    for (let j = best - 1; j >= 0; j--) out[j] = better(out[j], out[j + 1]) ? out[j + 1] : out[j];
    for (let j = best + 1; j < arr.length; j++) out[j] = better(out[j], out[j - 1]) ? out[j - 1] : out[j];
    return out;
  };
  const Lm = mono(Ls, (a, b) => a < b); // 小さいほど左（広い）
  const Rm = mono(Rs, (a, b) => a > b); // 大きいほど右（広い）
  const Lmin = Math.min(...Lm), Rmax = Math.max(...Rm);
  const wCells = Rmax - Lmin + 1;
  const notches: Notch[] = [];
  // 左側: 下から j* まで（SW）、j* から上（NW）。段が変わる行ごとに切り欠きを置く
  const jL = Lm.indexOf(Lmin), jR = Rm.indexOf(Rmax);
  const jLlast = Lm.lastIndexOf(Lmin), jRlast = Rm.lastIndexOf(Rmax);
  for (let j = 0; j < jL; j++) if (Lm[j] > Lmin && (j === jL - 1 || Lm[j] > Lm[j + 1])) notches.push({ corner: "SW", w: round((Lm[j] - Lmin) * HALF, 3), d: round((j + 1) * HALF, 3) });
  for (let j = nRows - 1; j > jLlast; j--) if (Lm[j] > Lmin && (j === jLlast + 1 || Lm[j] > Lm[j - 1])) notches.push({ corner: "NW", w: round((Lm[j] - Lmin) * HALF, 3), d: round((nRows - j) * HALF, 3) });
  for (let j = 0; j < jR; j++) if (Rm[j] < Rmax && (j === jR - 1 || Rm[j] < Rm[j + 1])) notches.push({ corner: "SE", w: round((Rmax - Rm[j]) * HALF, 3), d: round((j + 1) * HALF, 3) });
  for (let j = nRows - 1; j > jRlast; j--) if (Rm[j] < Rmax && (j === jRlast + 1 || Rm[j] < Rm[j - 1])) notches.push({ corner: "NE", w: round((Rmax - Rm[j]) * HALF, 3), d: round((nRows - j) * HALF, 3) });
  let cells = 0;
  for (let j = 0; j < nRows; j++) cells += Rm[j] - Lm[j] + 1;
  return { u: round(minU + Lmin * HALF, 3), v: round(v0, 3), w: round(wCells * HALF, 3), d: round(nRows * HALF, 3), notches, area: round(cells * HALF * HALF, 3), cells };
}
