/**
 * 天空率（建築基準法56条7項1号・道路高さ制限の適用除外）の計算。
 *
 * 前提（参考実装。確認申請に使う前に、確認申請ソフトや設計事務所の天空率図と照合すること）:
 * - 前面道路は「道路」とした辺 1 本だけ。2 以上の道路、道路との高低差、入隅、水面・公園の緩和は未対応。
 * - 適合建築物: 敷地のうち、前面道路の境界線から後退距離ぶん下がった内側で、
 *   道路斜線（勾配 × (道路幅員 + 後退距離 + 距離)）に適合する高さの立体。適用距離の範囲に限る。
 * - 計画建築物: 建物の外形（矩形）＋屋根形状。適用距離の範囲に限る（令135条の6 第1項一号の「限る部分」）。
 * - 算定位置（令135条の9）: 道路の反対側の境界線（後退緩和がある場合はその分だけ外側の線）上で、
 *   敷地が道路に接する部分の両端に最も近い位置と、その間を道路幅員の 1/2 以内の等間隔で区切った位置。
 *   高さは道路の路面の中心＝GL±0 とする。
 * - 天空率: 算定位置から見た天空の正射影図で、建築物に隠されない部分の面積の割合（令135条の5）。
 *   ここでは半球を細かく分割し、各方向のレイが立体に当たるかで数値積分する。
 *   正射影の面積要素 = cosθ·sinθ dθ dφ（θ: 仰角、φ: 方位角）、全天 = π。
 */
import type { Pt, Site, Building, GridSetting } from "./types";
import { baseFrame, toLocal, type Frame } from "./grid";
import { roofRise } from "./geometry";

export type SkyPoint = { index: number; u: number; v: number; plan: number; conform: number; ok: boolean };
export type SkyResult = {
  ok: boolean;
  points: SkyPoint[];
  worst: number;
  /** 最悪の算定位置での天空図（方位角ごとの建物の最大仰角、rad）: 計画・適合 */
  diagram: { plan: number[]; conform: number[] };
  info: { roadW: number; back: number; applyDist: number; slope: number; pitch: number; note: string[] };
};

/** 凸多角形の底面と、上面が平面 z = a + b·u + c·v の立体 */
type Prism = { poly: Pt[]; top: (u: number, v: number) => number; zmax: number };

/** レイ o + t·d が凸多角形（u,v）を通る t 区間を求める（Cyrus–Beck）。無ければ null */
function clipPolygon(poly: Pt[], o: Pt, d: Pt): [number, number] | null {
  let t0 = 0;
  let t1 = Infinity;
  const n = poly.length;
  // 多角形の向きを揃える（反時計回りにする）
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sgn = area >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    // 内向き法線
    const ex = b.x - a.x, ey = b.y - a.y;
    const nx = -ey * sgn, ny = ex * sgn;
    const num = (a.x - o.x) * nx + (a.y - o.y) * ny; // >0 なら o は外側
    const den = d.x * nx + d.y * ny;
    if (Math.abs(den) < 1e-12) {
      if (num > 0) return null; // 平行で外側
      continue;
    }
    const t = num / den;
    if (den > 0) { if (t > t0) t0 = t; } else { if (t < t1) t1 = t; }
    if (t0 > t1) return null;
  }
  return t0 <= t1 ? [t0, t1] : null;
}

/** 仰角 θ・方位 φ のレイ（原点 o、高さ 0）が立体に当たるか */
function hits(prism: Prism, o: Pt, cosT: number, sinT: number, cosP: number, sinP: number): boolean {
  if (prism.zmax <= 0) return false;
  const d = { x: cosT * cosP, y: cosT * sinP };
  // 水平距離 s に対して z = s·tanθ。仰角が高すぎて zmax に届く前に外へ出る場合も含め区間で判定
  const seg = clipPolygon(prism.poly, o, d);
  if (!seg) return false;
  const [s0, s1] = seg;
  if (s1 <= 1e-9) return false;
  const tan = sinT / Math.max(cosT, 1e-9);
  // 上面は平面なので f(s) = z(s) − top(s) は s の 1 次式。区間の両端で符号を見る
  const f = (s: number) => s * tan - prism.top(o.x + d.x * s, o.y + d.y * s);
  const fa = f(Math.max(s0, 0));
  const fb = f(Math.min(s1, 1e6));
  return fa <= 0 || fb <= 0;
}

/** 立体の集合に対する天空率と、方位ごとの最大仰角（天空図用） */
function skyFactor(prisms: Prism[], o: Pt, nAz: number, nAlt: number): { sky: number; profile: number[] } {
  let blocked = 0;
  const profile: number[] = new Array(nAz).fill(0);
  const dPhi = (2 * Math.PI) / nAz;
  const dTheta = Math.PI / 2 / nAlt;
  for (let i = 0; i < nAz; i++) {
    const phi = (i + 0.5) * dPhi;
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    let maxAlt = 0;
    for (let j = 0; j < nAlt; j++) {
      const theta = (j + 0.5) * dTheta;
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      let hit = false;
      for (const p of prisms) if (hits(p, o, cosT, sinT, cosP, sinP)) { hit = true; break; }
      if (hit) {
        blocked += cosT * sinT * dTheta * dPhi;
        maxAlt = theta + dTheta / 2;
      } else if (maxAlt > 0) {
        // 建物は地面から立ち上がるので、当たらなくなったらそれ以上は空
        break;
      }
    }
    profile[i] = maxAlt;
  }
  return { sky: 1 - blocked / Math.PI, profile };
}

/** 多角形を半平面 (n·p ≥ c) で切る（Sutherland–Hodgman） */
function clipHalf(poly: Pt[], n: Pt, c: number): Pt[] {
  const out: Pt[] = [];
  const m = poly.length;
  for (let i = 0; i < m; i++) {
    const a = poly[i], b = poly[(i + 1) % m];
    const da = n.x * a.x + n.y * a.y - c;
    const db = n.x * b.x + n.y * b.y - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** 凸包（敷地が凹の場合は安全側＝適合建築物が大きくなる方向に丸める） */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export type SkyInput = {
  site: Site;
  grid: GridSetting;
  building: Building;
  /** 道路斜線の勾配（1.25 / 1.5）と適用距離 */
  slope: number;
  applyDist: number;
  /** 屋根まで含めた各高さ（GL 基準）: 軒高と最高高さ */
  eave: number;
  maxHeight: number;
  /** 分割数（精度）。既定 720×180 */
  nAz?: number;
  nAlt?: number;
  /** 対象の道路の辺（未指定なら最初の道路）と、令132条でみなした幅員 */
  roadEdgeIndex?: number;
  effWidth?: number;
  /** 令135条の2 の高低差緩和: 算定位置（道路面とみなす高さ）の地盤面からの高さ（負） */
  zOff?: number;
};

/**
 * 道路高さ制限の天空率チェック。
 * 座標は「道路の辺を底辺にした座標系」（u: 道路に沿って、v: 敷地の内側へ）。
 */
export function checkSkyFactor(inp: SkyInput): SkyResult | { error: string } {
  const { site, grid, building: b, slope, applyDist } = inp;
  const roadEdge = inp.roadEdgeIndex !== undefined ? site.edges.find((e) => e.index === inp.roadEdgeIndex) : site.edges.find((e) => e.road);
  if (!roadEdge) return { error: "道路の辺が設定されていません" };
  const note: string[] = [];
  const roadW = inp.effWidth ?? roadEdge.roadWidth ?? 4;
  if (inp.effWidth !== undefined && inp.effWidth !== (roadEdge.roadWidth ?? 4)) note.push(`令132条により幅員 ${inp.effWidth}m とみなして計算`);
  const zOff = inp.zOff ?? 0;
  if (zOff !== 0) note.push(`高低差緩和: 算定位置の高さ ${zOff.toFixed(2)}m`);
  const rf: Frame = baseFrame(site, roadEdge.index);

  // 建物の4隅（世界座標 → 道路座標）
  const bf = baseFrame(site, grid.baseEdge);
  const toWorldB = (u: number, v: number) => ({ x: bf.a.x + u * bf.t.x + v * bf.n.x, y: bf.a.y + u * bf.t.y + v * bf.n.y });
  const cornersW = [toWorldB(grid.u, grid.v), toWorldB(grid.u + b.w, grid.v), toWorldB(grid.u + b.w, grid.v + b.d), toWorldB(grid.u, grid.v + b.d)];
  const cornersR = cornersW.map((p) => toLocal(rf, p));
  // 後退距離 = 建物のうち道路に最も近い部分の v
  const back = Math.max(0, Math.min(...cornersR.map((p) => p.y)));
  const siteR = site.points.map((p) => toLocal(rf, p));
  const hull = convexHull(siteR);
  if (hull.length !== siteR.length) note.push("敷地が凹形のため、適合建築物は凸包（外側に丸めた形）で計算しています（安全側）");

  // 適用距離の範囲（道路の反対側の境界線＝後退緩和で back だけ外側の線から測る）
  const vMax = applyDist - roadW - back; // 敷地内でこの v までが制限の対象
  if (vMax <= 0) return { error: "適用距離が短すぎて、敷地に道路斜線がかかりません（設定を確認）" };

  // ---- 適合建築物: 敷地(凸包) ∩ {v ≥ back} ∩ {v ≤ vMax}、上面 z = slope·(roadW + back + v)
  let confPoly = clipHalf(hull, { x: 0, y: 1 }, back);
  confPoly = clipHalf(confPoly, { x: 0, y: -1 }, -vMax);
  const conform: Prism[] = confPoly.length >= 3 ? [{ poly: confPoly, top: (_u, v) => slope * (roadW + back + v), zmax: slope * (roadW + back + vMax) }] : [];

  // ---- 計画建築物: 建物矩形 ∩ {v ≤ vMax}、上面は屋根形状
  // 屋根: 建物座標 (x: 底辺に沿って, y: 奥へ) で高さ関数を作り、道路座標に写す
  const rise = roofRise(b);
  const eave = inp.eave;
  const topLocal = (x: number, y: number): number => {
    if (b.roof === "flat") return inp.maxHeight;
    if (b.roof === "shed") {
      const t = b.roofHighSide === "N" ? y / b.d : b.roofHighSide === "S" ? 1 - y / b.d : b.roofHighSide === "E" ? x / b.w : 1 - x / b.w;
      return eave + rise * Math.max(0, Math.min(1, t));
    }
    // 切妻: 棟が roofHighSide の向き（N/S なら棟は南北方向）
    const ridgeNS = b.roofHighSide === "N" || b.roofHighSide === "S";
    const t = ridgeNS ? 1 - Math.abs(x / b.w - 0.5) * 2 : 1 - Math.abs(y / b.d - 0.5) * 2;
    return eave + rise * Math.max(0, Math.min(1, t));
  };
  // 道路座標 → 建物座標
  const toBuilding = (u: number, v: number) => {
    const w = { x: rf.a.x + u * rf.t.x + v * rf.n.x, y: rf.a.y + u * rf.t.y + v * rf.n.y };
    const l = toLocal(bf, w);
    return { x: l.x - grid.u, y: l.y - grid.v };
  };
  const planPrisms: Prism[] = [];
  const rectR = cornersR;
  const addPlan = (poly: Pt[]) => {
    const clipped = clipHalf(poly, { x: 0, y: -1 }, -vMax);
    if (clipped.length >= 3) planPrisms.push({ poly: clipped, top: (u, v) => { const p = toBuilding(u, v); return topLocal(p.x, p.y) - zOff; }, zmax: inp.maxHeight - zOff });
  };
  if (b.roof === "gable") {
    // 屋根面が2枚なので、棟で2つの立体に分ける（それぞれ上面が平面）
    const ridgeNS = b.roofHighSide === "N" || b.roofHighSide === "S";
    const halves: Pt[][] = ridgeNS
      ? [[toWorldB(grid.u, grid.v), toWorldB(grid.u + b.w / 2, grid.v), toWorldB(grid.u + b.w / 2, grid.v + b.d), toWorldB(grid.u, grid.v + b.d)], [toWorldB(grid.u + b.w / 2, grid.v), toWorldB(grid.u + b.w, grid.v), toWorldB(grid.u + b.w, grid.v + b.d), toWorldB(grid.u + b.w / 2, grid.v + b.d)]]
      : [[toWorldB(grid.u, grid.v), toWorldB(grid.u + b.w, grid.v), toWorldB(grid.u + b.w, grid.v + b.d / 2), toWorldB(grid.u, grid.v + b.d / 2)], [toWorldB(grid.u, grid.v + b.d / 2), toWorldB(grid.u + b.w, grid.v + b.d / 2), toWorldB(grid.u + b.w, grid.v + b.d), toWorldB(grid.u, grid.v + b.d)]];
    for (const h of halves) addPlan(h.map((p) => toLocal(rf, p)));
  } else {
    addPlan(rectR);
  }

  // ---- 算定位置: 道路の反対側の境界線（v = −roadW − back）上。敷地が道路に接する部分の両端の u
  const uMin = Math.min(...siteR.filter((p) => Math.abs(p.y) < 1e-6).map((p) => p.x));
  const uMax = Math.max(...siteR.filter((p) => Math.abs(p.y) < 1e-6).map((p) => p.x));
  const vLine = -(roadW + back);
  const span = uMax - uMin;
  const nDiv = Math.max(1, Math.ceil(span / (roadW / 2) - 1e-9));
  const pitch = span / nDiv;
  const nAz = inp.nAz ?? 720;
  const nAlt = inp.nAlt ?? 180;
  const points: SkyPoint[] = [];
  let worst = Infinity;
  let worstIdx = 0;
  let diagram = { plan: [] as number[], conform: [] as number[] };
  for (let i = 0; i <= nDiv; i++) {
    const o = { x: uMin + pitch * i, y: vLine };
    const c = skyFactor(conform, o, nAz, nAlt);
    const p = skyFactor(planPrisms, o, nAz, nAlt);
    // 審査実務にならい、適合は切り上げ・計画は切り捨て（小数第3位）で比較（安全側）
    const confR = Math.ceil(c.sky * 1000) / 1000;
    const planR = Math.floor(p.sky * 1000) / 1000;
    const ok = planR >= confR;
    const margin = planR - confR;
    if (margin < worst) { worst = margin; worstIdx = i; diagram = { plan: p.profile, conform: c.profile }; }
    points.push({ index: i + 1, u: o.x, v: o.y, plan: planR, conform: confR, ok });
  }
  void worstIdx;
  return {
    ok: points.every((p) => p.ok),
    points,
    worst,
    diagram,
    info: { roadW, back, applyDist, slope, pitch, note },
  };
}
