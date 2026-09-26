/**
 * 天空率（建築基準法56条7項1号・道路高さ制限の適用除外）の計算。
 *
 * 前提（参考実装。確認申請に使う前に、確認申請ソフトや設計事務所の天空率図と照合すること）:
 * - 前面道路は「道路」とした辺 1 本だけ。2 以上の道路、道路との高低差、入隅、水面・公園の緩和は未対応。
 * - 適合建築物: 敷地のうち、前面道路の境界線から後退距離ぶん下がった内側で、
 *   道路斜線（勾配 × (道路幅員 + 後退距離 + 距離)）に適合する高さの立体。適用距離の範囲に限る。
 * - 計画建築物: 建物の外形（矩形、角の切り欠きあり）＋屋根形状（片流れ・切妻・寄棟・陸屋根）。適用距離の範囲に限る（令135条の6 第1項一号の「限る部分」）。
 * - 算定位置（令135条の9）: 道路の反対側の境界線（後退緩和がある場合はその分だけ外側の線）上で、
 *   敷地が道路に接する部分の両端に最も近い位置と、その間を道路幅員の 1/2 以内の等間隔で区切った位置。
 *   高さは道路の路面の中心＝GL±0 とする。
 * - 天空率: 算定位置から見た天空の正射影図で、建築物に隠されない部分の面積の割合（令135条の5）。
 *   ここでは半球を細かく分割し、各方向のレイが立体に当たるかで数値積分する。
 *   正射影の面積要素 = cosθ·sinθ dθ dφ（θ: 仰角、φ: 方位角）、全天 = π。
 */
import type { Pt, Site, Building, GridSetting } from "./types";
import { baseFrame, toLocal, type Frame } from "./grid";
import { roofRise, buildingSolids, footprintPolygon } from "./geometry";

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
  // 水平方向の単位ベクトル。クリップで得る s はそのまま水平距離になる（以前は cosθ 倍のベクトルを使っていて
  // 高さを s·tanθ と過大に見積もり、天空率が 0.5〜3 ポイント高く出ていた。閉じた式との検算で発見・修正）
  const d = { x: cosP, y: sinP };
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
  const cornersW = footprintPolygon(b).map((p) => toWorldB(grid.u + p.x, grid.v + p.y));
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

  // ---- 計画建築物: 建物の外形（切り欠き含む）× 屋根面ごとの区画。それぞれ上面が平面の立体
  // 建物座標 (x: 底辺に沿って, y: 奥へ) の多角形を道路座標に写す
  const rise = roofRise(b);
  const eave = inp.eave;
  const toRoad = (p: Pt) => toLocal(rf, toWorldB(grid.u + p.x, grid.v + p.y));
  const toBuilding = (u: number, v: number) => {
    const w = { x: rf.a.x + u * rf.t.x + v * rf.n.x, y: rf.a.y + u * rf.t.y + v * rf.n.y };
    const l = toLocal(bf, w);
    return { x: l.x - grid.u, y: l.y - grid.v };
  };
  const planPrisms: Prism[] = [];
  for (const solid of buildingSolids(b, eave, rise, inp.maxHeight)) {
    const clipped = clipHalf(solid.poly.map(toRoad), { x: 0, y: -1 }, -vMax);
    if (clipped.length >= 3) planPrisms.push({ poly: clipped, top: (u, v) => { const p = toBuilding(u, v); return solid.top(p.x, p.y) - zOff; }, zmax: inp.maxHeight - zOff });
  }
  if (b.roofDrop && Object.values(b.roofDrop).some((v) => v && v > 0)) note.push("母屋下がりは天空率では無視（屋根を大きめに見る＝安全側）");

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

// ===== 隣地斜線・北側斜線の天空率（令135条の7・令135条の8）=====

export type BoundarySkyInput = {
  site: Site;
  grid: GridSetting;
  building: Building;
  kind: "neighbor" | "north";
  /** 対象の境界線（points[i] → points[i+1]） */
  edgeIndex: number;
  /** 斜線の起点高さと勾配（隣地: 20/1.25 or 31/2.5、北側: 5 or 10 / 1.25） */
  base: number;
  slope: number;
  eave: number;
  maxHeight: number;
  /** 北側用: 真北の向き（画面上から時計回り度）と、低層住専か（算定位置 4m・間隔 1m。中高層は 8m・2m） */
  northDeg?: number;
  lowRise?: boolean;
  nAz?: number;
  nAlt?: number;
};

/** 建物の立体を任意の座標系（frame）に写した計画建築物 */
function planPrismsIn(site: Site, grid: GridSetting, b: Building, rf: Frame, eave: number, maxHeight: number): Prism[] {
  const bf = baseFrame(site, grid.baseEdge);
  const toWorldB = (u: number, v: number) => ({ x: bf.a.x + u * bf.t.x + v * bf.n.x, y: bf.a.y + u * bf.t.y + v * bf.n.y });
  const toRoad = (p: Pt) => toLocal(rf, toWorldB(grid.u + p.x, grid.v + p.y));
  const toBuilding = (u: number, v: number) => {
    const w = { x: rf.a.x + u * rf.t.x + v * rf.n.x, y: rf.a.y + u * rf.t.y + v * rf.n.y };
    const l = toLocal(bf, w);
    return { x: l.x - grid.u, y: l.y - grid.v };
  };
  const out: Prism[] = [];
  for (const solid of buildingSolids(b, eave, roofRise(b), maxHeight)) {
    const poly = solid.poly.map(toRoad);
    if (poly.length >= 3) out.push({ poly, top: (u, v) => { const p = toBuilding(u, v); return solid.top(p.x, p.y); }, zmax: maxHeight });
  }
  return out;
}

function evalPoints(conform: Prism[], plan: Prism[], pts: Pt[], nAz: number, nAlt: number) {
  const points: SkyPoint[] = [];
  let worst = Infinity;
  let diagram = { plan: [] as number[], conform: [] as number[] };
  pts.forEach((o, i) => {
    const c = skyFactor(conform, o, nAz, nAlt);
    const p = skyFactor(plan, o, nAz, nAlt);
    const confR = Math.ceil(c.sky * 1000) / 1000;
    const planR = Math.floor(p.sky * 1000) / 1000;
    const margin = planR - confR;
    if (margin < worst) { worst = margin; diagram = { plan: p.profile, conform: c.profile }; }
    points.push({ index: i + 1, u: o.x, v: o.y, plan: planR, conform: confR, ok: planR >= confR });
  });
  return { points, worst, diagram };
}

/**
 * 隣地斜線（令135条の7）・北側斜線（令135条の8）の天空率。
 * 隣地: 対象の隣地境界線を底辺にした座標系。適合建築物 = 敷地（凸包）で高さ ≤ base + slope×(境界からの距離)。
 *       算定位置は境界線から base/slope（16m or 12.4m）外側の線上、両端と、その間を (base/slope)/2 以内の等間隔。
 * 北側: 真北を v 軸にした座標系。適合建築物 = 敷地（凸包）を東西の細い帯に分け、各帯で高さ ≤ base + slope×(北側境界までの真北距離)。
 *       北側境界が道路なら反対側の境界線から測る。算定位置は対象の境界線を真北へ 4m（低層）/8m（中高層）動かした線上、間隔 1m/2m 以内。
 * 後退緩和（法56条6項・7項の適合建築物の後退）は未対応（適合建築物を小さく見る＝安全側）。
 */
export function checkSkyFactorBoundary(inp: BoundarySkyInput): SkyResult | { error: string } {
  const { site, grid, building: b, base, slope } = inp;
  const n = site.points.length;
  const edge = site.edges.find((e) => e.index === inp.edgeIndex);
  const isRoad = !!edge?.road;
  const note: string[] = [];
  const nAz = inp.nAz ?? 360;
  const nAlt = inp.nAlt ?? 90;
  if (inp.kind === "neighbor") {
    if (isRoad) return { error: "道路に接する辺には隣地斜線はかかりません" };
    const rf = baseFrame(site, inp.edgeIndex);
    const hull = convexHull(site.points.map((p) => toLocal(rf, p)));
    if (hull.length !== site.points.length) note.push("敷地が凹形のため凸包で計算（安全側）");
    const confPoly = clipHalf(hull, { x: 0, y: 1 }, 0);
    const zmax = base + slope * Math.max(...confPoly.map((p) => p.y));
    const conform: Prism[] = confPoly.length >= 3 ? [{ poly: confPoly, top: (_u, v) => base + slope * Math.max(0, v), zmax }] : [];
    const plan = planPrismsIn(site, grid, b, rf, inp.eave, inp.maxHeight);
    const D = base / slope;
    const nDiv = Math.max(1, Math.ceil(rf.len / (D / 2) - 1e-9));
    const pitch = rf.len / nDiv;
    const pts: Pt[] = [];
    for (let i = 0; i <= nDiv; i++) pts.push({ x: pitch * i, y: -D });
    const r = evalPoints(conform, plan, pts, nAz, nAlt);
    return { ok: r.points.every((p) => p.ok), points: r.points, worst: r.worst, diagram: r.diagram, info: { roadW: 0, back: 0, applyDist: D, slope, pitch, note: [`算定位置は境界線から ${D}m 外側、間隔 ${pitch.toFixed(2)}m`, ...note] } };
  }
  // ---- 北側
  const nd = ((inp.northDeg ?? site.northDeg) * Math.PI) / 180;
  const north = { x: Math.sin(nd), y: Math.cos(nd) };
  const east = { x: Math.cos(nd), y: -Math.sin(nd) };
  const a = site.points[inp.edgeIndex], c = site.points[(inp.edgeIndex + 1) % n];
  const rf: Frame = { a: { x: a.x, y: a.y }, t: east, n: north, len: Math.hypot(c.x - a.x, c.y - a.y), reversed: false };
  const siteR = site.points.map((p) => toLocal(rf, p));
  const hull = convexHull(siteR);
  if (hull.length !== siteR.length) note.push("敷地が凹形のため凸包で計算（安全側）");
  // 対象の辺が北を向いているか（外向き法線の北成分 > 0）
  const ccw = siteR.reduce((s, p, i) => { const q = siteR[(i + 1) % n]; return s + p.x * q.y - q.x * p.y; }, 0) > 0;
  const ex = c.x - a.x, ey = c.y - a.y;
  const outward = ccw ? { x: ey, y: -ex } : { x: -ey, y: ex };
  if (outward.x * north.x + outward.y * north.y <= 1e-9) return { error: "この辺は北を向いていないので北側斜線の対象外です" };
  // 北側境界（道路なら反対側）までの距離: 東西の帯ごとに、帯の中心から真北へ伸ばして最後に交わる敷地の辺
  const roadW = (i: number) => site.edges.find((e) => e.index === i)?.roadWidth ?? 4;
  const roadIdx = new Set(site.edges.filter((e) => e.road).map((e) => e.index));
  const uMin = Math.min(...hull.map((p) => p.x)), uMax = Math.max(...hull.map((p) => p.x));
  const vMin = Math.min(...hull.map((p) => p.y));
  const ds = 0.25;
  const conform: Prism[] = [];
  for (let u0 = uMin; u0 < uMax - 1e-9; u0 += ds) {
    const u1 = Math.min(uMax, u0 + ds);
    const um = (u0 + u1) / 2;
    // 帯の中心から北へ: 敷地の辺との交点のうち最も北のもの
    let vb = -Infinity, hitIdx = -1;
    for (let i = 0; i < n; i++) {
      const p = siteR[i], q = siteR[(i + 1) % n];
      if ((p.x <= um) === (q.x <= um)) continue;
      const t = (um - p.x) / (q.x - p.x);
      const v = p.y + (q.y - p.y) * t;
      if (v > vb) { vb = v; hitIdx = i; }
    }
    if (!Number.isFinite(vb)) continue;
    const vBoundary = vb + (roadIdx.has(hitIdx) ? roadW(hitIdx) : 0);
    let poly = clipHalf(hull, { x: 1, y: 0 }, u0);
    poly = clipHalf(poly, { x: -1, y: 0 }, -u1);
    if (poly.length < 3) continue;
    conform.push({ poly, top: (_u, v) => base + slope * Math.max(0, vBoundary - v), zmax: base + slope * (vBoundary - vMin) });
  }
  const plan = planPrismsIn(site, grid, b, rf, inp.eave, inp.maxHeight);
  const D = inp.lowRise ? 4 : 8;
  const spacing = inp.lowRise ? 1 : 2;
  // 算定位置: 対象の辺（道路なら反対側の線）を真北へ D 動かした線上
  const shift = (isRoad ? roadW(inp.edgeIndex) : 0) + D;
  const aR = toLocal(rf, a), cR = toLocal(rf, c);
  const nDiv = Math.max(1, Math.ceil(rf.len / spacing - 1e-9));
  const pts: Pt[] = [];
  for (let i = 0; i <= nDiv; i++) { const t = i / nDiv; pts.push({ x: aR.x + (cR.x - aR.x) * t, y: aR.y + (cR.y - aR.y) * t + shift }); }
  if (isRoad) note.push(`北側が道路（幅 ${roadW(inp.edgeIndex)}m）のため、道路の反対側の線から ${D}m 北に算定位置を置いています`);
  const r = evalPoints(conform, plan, pts, nAz, nAlt);
  return { ok: r.points.every((p) => p.ok), points: r.points, worst: r.worst, diagram: r.diagram, info: { roadW: isRoad ? roadW(inp.edgeIndex) : 0, back: 0, applyDist: D, slope, pitch: rf.len / nDiv, note: [`算定位置は境界線の ${D}m 北、間隔 ${(rf.len / nDiv).toFixed(2)}m（${conform.length} 帯で近似）`, ...note] } };
}
