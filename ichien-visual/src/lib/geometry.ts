import type { Pt, Site, Building, Face, Project, Notch } from "./types";

export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 多角形の符号付き面積（正なら反時計回り） */
export function signedArea(pts: Pt[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function polygonArea(pts: Pt[]) {
  return Math.abs(signedArea(pts));
}

export function centroid(pts: Pt[]): Pt {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let cx = 0,
    cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / n, y: cy / n };
}

export function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function lineIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / det;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

/** 多角形を内側に一定距離オフセットする（民法234条の離れ線用） */
export function insetPolygon(pts: Pt[], offset: number): Pt[] {
  const n = pts.length;
  if (n < 3 || offset <= 0) return pts;
  const ccw = signedArea(pts) > 0;
  const lines: { p: Pt; d: Pt }[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // 内側向きの法線
    const nx = ccw ? -dy / len : dy / len;
    const ny = ccw ? dx / len : -dx / len;
    lines.push({
      p: { x: a.x + nx * offset, y: a.y + ny * offset },
      d: { x: dx, y: dy },
    });
  }
  // 長さ0の辺（道路後退で重なった点など）は無視して、前後の「長さのある辺」どうしの交点を取る
  const ok = lines.map((l) => Math.hypot(l.d.x, l.d.y) > 1e-6);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    let pi = (i - 1 + n) % n;
    for (let k = 0; k < n && !ok[pi]; k++) pi = (pi - 1 + n) % n;
    let ci = i;
    for (let k = 0; k < n && !ok[ci]; k++) ci = (ci + 1) % n;
    const prev = lines[pi];
    const cur = lines[ci];
    const ip = ok[pi] && ok[ci] ? lineIntersect(prev.p, prev.d, cur.p, cur.d) : null;
    if (ip) { out.push(ip); continue; }
    // 平行（ほぼ一直線）のときは、辺を法線方向へずらした点で代用する
    const l = ok[ci] ? cur : prev;
    const len = Math.hypot(l.d.x, l.d.y) || 1;
    const a0 = pts[i];
    const nx = ccw ? -l.d.y / len : l.d.y / len;
    const ny = ccw ? l.d.x / len : -l.d.x / len;
    out.push({ x: a0.x + nx * offset, y: a0.y + ny * offset });
  }
  return out;
}

/**
 * 道路後退（セットバック）を差し引いた「有効敷地」。
 * roadSetback が付いた道路辺を内側へ平行移動し、その帯に入る境界点を移動線との交点へ寄せる。
 * 点の数と辺番号はそのまま（帯の中に落ちた点は交点に重なり、長さ0の辺になる）ので、
 * grid.baseEdge や edges[].index はそのまま使える。後退した辺は幅員を「元の幅＋後退×2」（＝原則4m）に直す。
 */
export function effectiveSite(site: Site): Site {
  const n = site.points.length;
  const targets = site.edges.filter((e) => e.road && (e.roadSetback ?? 0) > 0.001 && e.index < n);
  if (n < 3 || targets.length === 0) return site;
  let pts = site.points.map((p) => ({ ...p }));
  const ccw = signedArea(pts) > 0;
  for (const e of targets) {
    const s = e.roadSetback!;
    const a = pts[e.index];
    const b = pts[(e.index + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    // 内側向きの法線
    const nx = ccw ? -dy / len : dy / len;
    const ny = ccw ? dx / len : -dx / len;
    const lp = { x: a.x + nx * s, y: a.y + ny * s }; // 後退線上の点
    const ld = { x: dx, y: dy };
    const depth = (p: Pt) => (p.x - lp.x) * nx + (p.y - lp.y) * ny; // 負なら道路側（帯の中）
    const out = pts.map((p) => depth(p) < 1e-9);
    if (out.every(Boolean)) continue;
    const next = pts.map((p) => ({ ...p }));
    const start = out.findIndex((o) => !o); // 敷地側に残る点から一周する（区間が配列の端をまたいでも良いように）
    let k = 0;
    while (k < n) {
      const i = (start + k) % n;
      if (!out[i]) { k++; continue; }
      // 帯の中に落ちた点の連続区間
      let kj = k;
      while (kj + 1 < n && out[(start + kj + 1) % n]) kj++;
      const j = (start + kj) % n;
      const prev = pts[(i - 1 + n) % n];
      const after = pts[(j + 1) % n];
      const ia = lineIntersect(prev, { x: pts[i].x - prev.x, y: pts[i].y - prev.y }, lp, ld) ?? pts[i];
      const ib = lineIntersect(after, { x: pts[j].x - after.x, y: pts[j].y - after.y }, lp, ld) ?? pts[j];
      for (let q = k; q <= kj; q++) {
        const idx = (start + q) % n;
        next[idx] = q === kj ? { x: round(ib.x, 4), y: round(ib.y, 4) } : { x: round(ia.x, 4), y: round(ia.y, 4) };
      }
      k = kj + 1;
    }
    pts = next;
  }
  const edges = site.edges.map((e) => {
    const t = targets.find((x) => x.index === e.index);
    const { length: _len, ...rest } = e;
    void _len;
    if (!t) return rest;
    return { ...rest, roadSetback: 0, roadWidth: round((e.roadWidth ?? 4) + 2 * (e.roadSetback ?? 0), 2), roadLabel: `${e.roadLabel ?? "公道"}（後退後）` };
  });
  return { ...site, points: pts, edges, areaOverride: undefined, effectiveAreaOverride: undefined };
}

/** 道路後退で削られる面積 m2（後退がなければ 0） */
export function setbackStripArea(site: Site) {
  const eff = effectiveSite(site);
  if (eff === site) return 0;
  return Math.max(0, polygonArea(site.points) - polygonArea(eff.points));
}

/** 建ぺい率・容積率の分母にする敷地面積（道路後退後の有効面積） */
export function siteAreaOf(site: Site) {
  if (site.effectiveAreaOverride !== undefined) return site.effectiveAreaOverride;
  const base = site.areaOverride ?? polygonArea(site.points);
  return Math.max(0, base - setbackStripArea(site));
}

/** 点が多角形内にあるか */
export function pointInPolygon(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 点から線分への最短距離 */
export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** 建物外形（回転あり矩形）の4隅を敷地座標で返す。順番: 南西, 南東, 北東, 北西 */
export function buildingCorners(b: Building): Pt[] {
  const r = (b.rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const local: Pt[] = [
    { x: 0, y: 0 },
    { x: b.w, y: 0 },
    { x: b.w, y: b.d },
    { x: 0, y: b.d },
  ];
  return local.map((p) => ({
    x: b.x + p.x * cos - p.y * sin,
    y: b.y + p.x * sin + p.y * cos,
  }));
}

/** 建物の各隅から敷地境界までの最短距離（m）と、離れ不足の隅 */
export function clearanceReport(site: Site, b: Building) {
  site = effectiveSite(site);
  const corners = buildingCorners(b);
  const n = site.points.length;
  const results = corners.map((c) => {
    let min = Infinity;
    let edgeIndex = -1;
    for (let i = 0; i < n; i++) {
      const d = distToSegment(c, site.points[i], site.points[(i + 1) % n]);
      if (d < min) {
        min = d;
        edgeIndex = i;
      }
    }
    const inside = pointInPolygon(c, site.points);
    return { corner: c, min: inside ? min : -min, edgeIndex, inside };
  });
  const required = site.fireproofException ? 0 : site.setback;
  const violations = results.filter((r) => !r.inside || r.min < required - 1e-6);
  return { results, violations, required };
}

/** 面の長さ（外形矩形） */
export function faceLength(b: Building, face: Face) {
  return face === "N" || face === "S" ? b.w : b.d;
}

export function buildingHeight(b: Building) {
  const walls = b.floorHeights.slice(0, b.floors).reduce((a, v) => a + v, 0);
  const slabs = 0.35 * (b.floors - 1);
  return b.foundation + walls + slabs;
}

/** 片流れ屋根の高低差 m（勾配 寸 = 10あたりの立ち上がり） */
export function roofRise(b: Building) {
  if (b.roof === "flat") return 0;
  const alongY = b.roofHighSide === "N" || b.roofHighSide === "S";
  // 寄棟: 短い方の半分で棟の高さが決まる
  if (b.roof === "hip") return (Math.min(b.w, b.d) / 2 * b.roofPitchSun) / 10;
  // 片流れ: 高い側へ向かう長さ。切妻: 棟と直交する向きの半分
  const run = b.roof === "gable" ? (alongY ? b.w : b.d) / 2 : alongY ? b.d : b.w;
  return (run * b.roofPitchSun) / 10;
}

export const m2ToTsubo = (m2: number) => m2 / 3.30578;
export const m2ToTatami = (m2: number) => m2 / (0.91 * 1.82);

/** 面の外向き法線（世界座標） */
export function faceNormalWorld(b: Building, face: Face): Pt {
  const r = (b.rotDeg * Math.PI) / 180;
  const xh = { x: Math.cos(r), y: Math.sin(r) };
  const yh = { x: -Math.sin(r), y: Math.cos(r) };
  switch (face) {
    case "E":
      return xh;
    case "W":
      return { x: -xh.x, y: -xh.y };
    case "N":
      return yh;
    default:
      return { x: -yh.x, y: -yh.y };
  }
}

/** 面が向いている方角（8方位） */
export function faceCompass(b: Building, face: Face, northDeg: number): string {
  const v = faceNormalWorld(b, face);
  const nd = (northDeg * Math.PI) / 180;
  const north = { x: Math.sin(nd), y: Math.cos(nd) };
  const east = { x: Math.cos(nd), y: -Math.sin(nd) };
  const ang = ((Math.atan2(v.x * east.x + v.y * east.y, v.x * north.x + v.y * north.y) * 180) / Math.PI + 360) % 360;
  const names = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  return names[Math.round(ang / 45) % 8];
}

/** 道路に最も向いている面 */
export function roadFaceOf(site: Site, b: Building): Face | null {
  site = effectiveSite(site);
  const e = site.edges.find((x) => x.road);
  if (!e) return null;
  const a = site.points[e.index];
  const c = site.points[(e.index + 1) % site.points.length];
  const corners = buildingCorners(b);
  const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
  const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
  const d = { x: (a.x + c.x) / 2 - cx, y: (a.y + c.y) / 2 - cy };
  let best: Face = "S";
  let bestDot = -Infinity;
  for (const f of ["N", "S", "E", "W"] as Face[]) {
    const n = faceNormalWorld(b, f);
    const dot = n.x * d.x + n.y * d.y;
    if (dot > bestDot) {
      bestDot = dot;
      best = f;
    }
  }
  return best;
}


/**
 * 画面上での北の向き（画面の上を 0 とした時計回りの度数）。
 * 方位の元は site.northDeg ひとつだけ。敷地図はそのまま、配置図・間取り図は
 * 底辺を基準にした回転（building.rotDeg）と反転（grid.flip）を足す。
 */
export function northScreenDeg(project: Pick<Project, "site" | "building" | "grid">, view: "site" | "plan"): number {
  const base = project.site.northDeg;
  const norm = (v: number) => Math.round((((v % 360) + 360) % 360) * 100) / 100;
  if (view === "site") return norm(base);
  return norm(base + project.building.rotDeg + (project.grid?.flip ? 180 : 0));
}


/** 面を外から見て左端から m の位置（外壁線上）の世界座標。openings.ts の並びと同じ */
export function facePointWorld(b: Building, face: Face, m: number): Pt {
  const local = face === "S" ? { x: m, y: 0 } : face === "N" ? { x: b.w - m, y: b.d } : face === "W" ? { x: 0, y: b.d - m } : { x: b.w, y: m };
  const r = (b.rotDeg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: b.x + local.x * cos - local.y * sin, y: b.y + local.x * sin + local.y * cos };
}


/**
 * 屋根面の高さ（GL基準 m）。建物座標 (x, y) は外壁の外側（軒の出の範囲）でもよい。
 * eave = 軒高（外壁面での屋根下端）、rise = 屋根の高低差。
 * 片流れ: 高い側へ向かって直線に上がる。切妻: 棟で最高、両側へ下がる。陸屋根: 一定。
 * 外壁の外側では、勾配のある向きは同じ勾配で下がり続け、けらば側は外壁面と同じ高さ。
 */
export function roofHeightAt(b: Building, x: number, y: number, eave: number, rise: number, maxHeight: number): number {
  if (b.roof === "flat") return maxHeight;
  const pitch = b.roofPitchSun / 10;
  let z = roofBase(b, x, y, eave, rise, pitch);
  // 母屋下がり: 面ごとに、外壁から drop 内側の線から同じ勾配で下がる面との低い方
  const d = b.roofDrop ?? {};
  const planes: number[] = [];
  if (d.N) planes.push(eave - pitch * (y - (b.d - d.N)));
  if (d.S) planes.push(eave - pitch * (d.S - y));
  if (d.E) planes.push(eave - pitch * (x - (b.w - d.E)));
  if (d.W) planes.push(eave - pitch * (d.W - x));
  for (const pz of planes) z = Math.min(z, pz);
  return z;
}

function roofBase(b: Building, x: number, y: number, eave: number, rise: number, pitch: number): number {
  if (b.roof === "hip") {
    // 寄棟: 4 辺の軒からそれぞれ同じ勾配で上がる屋根面の低い方（外壁の外側は負の距離＝軒先へ下がる）
    const dmin = Math.min(x, b.w - x, y, b.d - y);
    return Math.min(eave + pitch * dmin, eave + rise);
  }
  if (b.roof === "shed") {
    // 高い側の面に向かう座標 s（0 = 低い側の外壁、run = 高い側の外壁）
    const alongY = b.roofHighSide === "N" || b.roofHighSide === "S";
    const run = alongY ? b.d : b.w;
    const s = b.roofHighSide === "N" ? y : b.roofHighSide === "S" ? b.d - y : b.roofHighSide === "E" ? x : b.w - x;
    // 低い側の外側（s<0）は勾配で下がる。高い側の外側（s>run）は水平（けらば扱い）
    return eave + pitch * Math.min(s, run);
  }
  // 切妻: 棟が N/S なら棟は南北方向（x = w/2）で東西へ下がる。E/W なら棟は東西方向（y = d/2）
  const ridgeNS = b.roofHighSide === "N" || b.roofHighSide === "S";
  const dist = ridgeNS ? Math.abs(x - b.w / 2) : Math.abs(y - b.d / 2);
  return eave + rise - pitch * dist;
}


// ===== 建物外形（矩形＋角の切り欠き） =====

/** 有効な切り欠きだけ（寸法が正で、矩形より小さいもの） */
export function notchesOf(b: Building): Notch[] {
  return (b.notches ?? []).filter((n) => n.w > 1e-6 && n.d > 1e-6 && n.w < b.w - 1e-6 && n.d < b.d - 1e-6);
}

/** 切り欠き矩形（建物座標）の範囲 */
export function notchRect(b: Building, n: Notch) {
  const x0 = n.corner === "SW" || n.corner === "NW" ? 0 : b.w - n.w;
  const y0 = n.corner === "SW" || n.corner === "SE" ? 0 : b.d - n.d;
  return { x0, y0, x1: x0 + n.w, y1: y0 + n.d };
}

/** 建物座標の点が外形（切り欠き後）の内側か。tol は外側への許容（軒の出など） */
export function insideFootprint(b: Building, x: number, y: number, tol = 0): boolean {
  if (x < -tol - 1e-9 || x > b.w + tol + 1e-9 || y < -tol - 1e-9 || y > b.d + tol + 1e-9) return false;
  for (const n of notchesOf(b)) {
    const r = notchRect(b, n);
    // 切り欠きの内側（tol だけ内側に狭めた範囲）にあれば外
    if (x > r.x0 + (r.x0 > 0 ? tol : -1) && x < r.x1 - (r.x1 < b.w ? tol : -1) && y > r.y0 + (r.y0 > 0 ? tol : -1) && y < r.y1 - (r.y1 < b.d ? tol : -1)) return false;
  }
  return true;
}


/**
 * 角ごとの切り欠きを「階段」にまとめる: 同じ角の矩形の和集合の境界を、その角を原点にした (a=角からの幅方向, b=奥行方向) で返す。
 * 返す点列は、幅方向の辺上の点 (aMax, 0) から始まり、奥行方向の辺上の点 (0, bMax) で終わる階段。
 */
function cornerStair(ns: Notch[]): { a: number; b: number }[] {
  if (!ns.length) return [];
  // 幅 a 昇順に並べ、他に含まれる矩形（a も b も小さい）は捨てる → b は狭義単調減少
  const sorted = [...ns].map((n) => ({ a: n.w, b: n.d })).sort((p, q) => p.a - q.a || q.b - p.b);
  const pareto: { a: number; b: number }[] = [];
  for (const r of sorted) {
    while (pareto.length && pareto[pareto.length - 1].b <= r.b + 1e-9 && pareto[pareto.length - 1].a <= r.a + 1e-9) pareto.pop();
    if (!pareto.length || r.b < pareto[pareto.length - 1].b - 1e-9) pareto.push(r);
  }
  // 階段: (aK, 0) → (aK, bK) → (aK-1, bK) → (aK-1, bK-1) → … → (a1, b1) → (0, b1)
  const pts: { a: number; b: number }[] = [];
  const k = pareto.length;
  pts.push({ a: pareto[k - 1].a, b: 0 });
  for (let i = k - 1; i >= 0; i--) {
    pts.push({ a: pareto[i].a, b: pareto[i].b });
    if (i > 0) pts.push({ a: pareto[i - 1].a, b: pareto[i].b });
  }
  pts.push({ a: 0, b: pareto[0].b });
  return pts;
}

/** 外形の多角形（建物座標、反時計回り: 底辺左から）。角ごとに複数の切り欠き（階段状）に対応 */
export function footprintPolygon(b: Building): Pt[] {
  const ns = notchesOf(b);
  const by = (c: Notch["corner"]) => ns.filter((n) => n.corner === c);
  const pts: Pt[] = [];
  // 各角の階段を、反時計回りの向きに合わせて建物座標へ写す
  const sw = cornerStair(by("SW")); // 原点 (0,0)、a=+x、b=+y。反時計回りでは (0,b)… → (a,0) の順
  if (sw.length) for (const q of [...sw].reverse()) pts.push({ x: q.a, y: q.b }); else pts.push({ x: 0, y: 0 });
  const se = cornerStair(by("SE")); // 原点 (w,0)、a=-x、b=+y。順: (a,0)=(w-a,0) → … → (0,b)=(w,b)
  if (se.length) for (const q of se) pts.push({ x: b.w - q.a, y: q.b }); else pts.push({ x: b.w, y: 0 });
  const ne = cornerStair(by("NE")); // 原点 (w,d)、a=-x、b=-y。順: (0,b)=(w,d-b) → … → (a,0)=(w-a,d)
  if (ne.length) for (const q of [...ne].reverse()) pts.push({ x: b.w - q.a, y: b.d - q.b }); else pts.push({ x: b.w, y: b.d });
  const nw = cornerStair(by("NW")); // 原点 (0,d)、a=+x、b=-y。順: (a,0)=(a,d) → … → (0,b)=(0,d-b)
  if (nw.length) for (const q of nw) pts.push({ x: q.a, y: b.d - q.b }); else pts.push({ x: 0, y: b.d });
  // 連続する同じ点を落とす
  return pts.filter((q, i) => i === 0 || Math.abs(q.x - pts[i - 1].x) > 1e-9 || Math.abs(q.y - pts[i - 1].y) > 1e-9);
}

/** 建築面積（切り欠きを引いた外形の面積） */
export function footprintArea(b: Building): number {
  return polygonArea(footprintPolygon(b));
}

/** 外形を重ならない矩形に分割（建物座標）。天空率・日影の立体を作るのに使う */
export function footprintRects(b: Building): { x0: number; y0: number; x1: number; y1: number }[] {
  const ns = notchesOf(b);
  const ys = Array.from(new Set([0, b.d, ...ns.flatMap((n) => { const r = notchRect(b, n); return [r.y0, r.y1]; })])).sort((p, q) => p - q);
  const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let i = 0; i + 1 < ys.length; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (y1 - y0 < 1e-9) continue;
    const ym = (y0 + y1) / 2;
    let x0 = 0, x1 = b.w;
    for (const n of ns) {
      const r = notchRect(b, n);
      if (ym > r.y0 && ym < r.y1) { if (r.x0 <= 1e-9) x0 = Math.max(x0, r.x1); else x1 = Math.min(x1, r.x0); }
    }
    if (x1 - x0 > 1e-9) out.push({ x0, y0, x1, y1 });
  }
  return out;
}

/** 建物座標 → 敷地座標 */
export function buildingToWorld(b: Building, p: Pt): Pt {
  const r = (b.rotDeg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: b.x + p.x * cos - p.y * sin, y: b.y + p.x * sin + p.y * cos };
}

/** 外形の多角形（敷地座標） */
export function footprintWorld(b: Building): Pt[] {
  return footprintPolygon(b).map((p) => buildingToWorld(b, p));
}

/**
 * 屋根を「上面が平面の凸多角形」に分割する（建物座標、矩形全体を覆う）。
 * 母屋下がりは含まない（天空率・日影では屋根を大きめに見る＝安全側）。
 */
export function roofPlanes(b: Building, eave: number, rise: number, maxHeight: number): { poly: Pt[]; top: (x: number, y: number) => number }[] {
  const pitch = b.roofPitchSun / 10;
  const R = (x0: number, y0: number, x1: number, y1: number): Pt[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  if (b.roof === "flat") return [{ poly: R(0, 0, b.w, b.d), top: () => maxHeight }];
  if (b.roof === "shed") return [{ poly: R(0, 0, b.w, b.d), top: (x, y) => roofBase(b, Math.max(0, Math.min(b.w, x)), Math.max(0, Math.min(b.d, y)), eave, rise, pitch) }];
  if (b.roof === "gable") {
    const ridgeNS = b.roofHighSide === "N" || b.roofHighSide === "S";
    const polys = ridgeNS ? [R(0, 0, b.w / 2, b.d), R(b.w / 2, 0, b.w, b.d)] : [R(0, 0, b.w, b.d / 2), R(0, b.d / 2, b.w, b.d)];
    return polys.map((poly) => ({ poly, top: (x, y) => roofBase(b, x, y, eave, rise, pitch) }));
  }
  // 寄棟: 4 面。短辺方向の半分 h で棟が決まる
  const h = Math.min(b.w, b.d) / 2;
  const planes: { poly: Pt[]; top: (x: number, y: number) => number }[] = [];
  if (b.w >= b.d) {
    // 棟は x 方向（y = d/2、x ∈ [h, w−h]）
    planes.push({ poly: [{ x: 0, y: 0 }, { x: b.w, y: 0 }, { x: b.w - h, y: h }, { x: h, y: h }], top: (_x, y) => eave + pitch * y }); // 底辺側の面
    planes.push({ poly: [{ x: 0, y: b.d }, { x: h, y: b.d - h }, { x: b.w - h, y: b.d - h }, { x: b.w, y: b.d }], top: (_x, y) => eave + pitch * (b.d - y) }); // 奥側
    planes.push({ poly: [{ x: 0, y: 0 }, { x: h, y: h }, { x: h, y: b.d - h }, { x: 0, y: b.d }], top: (x) => eave + pitch * x }); // 左
    planes.push({ poly: [{ x: b.w, y: 0 }, { x: b.w, y: b.d }, { x: b.w - h, y: b.d - h }, { x: b.w - h, y: h }], top: (x) => eave + pitch * (b.w - x) }); // 右
  } else {
    planes.push({ poly: [{ x: 0, y: 0 }, { x: b.w, y: 0 }, { x: b.w - h, y: h }, { x: h, y: h }], top: (_x, y) => eave + pitch * y });
    planes.push({ poly: [{ x: 0, y: b.d }, { x: h, y: b.d - h }, { x: b.w - h, y: b.d - h }, { x: b.w, y: b.d }], top: (_x, y) => eave + pitch * (b.d - y) });
    planes.push({ poly: [{ x: 0, y: 0 }, { x: h, y: h }, { x: h, y: b.d - h }, { x: 0, y: b.d }], top: (x) => eave + pitch * x });
    planes.push({ poly: [{ x: b.w, y: 0 }, { x: b.w, y: b.d }, { x: b.w - h, y: b.d - h }, { x: b.w - h, y: h }], top: (x) => eave + pitch * (b.w - x) });
  }
  return planes.filter((p) => polygonArea(p.poly) > 1e-9);
}

/** 凸多角形を半平面 (n·p ≥ c) で切る（Sutherland–Hodgman） */
export function clipHalfPlane(poly: Pt[], n: Pt, c: number): Pt[] {
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

/** 凸多角形を軸に平行な矩形で切る */
export function clipToRect(poly: Pt[], r: { x0: number; y0: number; x1: number; y1: number }): Pt[] {
  let p = clipHalfPlane(poly, { x: 1, y: 0 }, r.x0);
  p = clipHalfPlane(p, { x: -1, y: 0 }, -r.x1);
  p = clipHalfPlane(p, { x: 0, y: 1 }, r.y0);
  p = clipHalfPlane(p, { x: 0, y: -1 }, -r.y1);
  return p;
}

/**
 * 建物の立体を「凸多角形の底面＋平面の上面」の集まりにする（建物座標）。
 * 屋根面ごとの区画 × 外形の矩形分割。天空率・日影の計算に使う。
 */
export function buildingSolids(b: Building, eave: number, rise: number, maxHeight: number): { poly: Pt[]; top: (x: number, y: number) => number }[] {
  const out: { poly: Pt[]; top: (x: number, y: number) => number }[] = [];
  for (const plane of roofPlanes(b, eave, rise, maxHeight)) for (const r of footprintRects(b)) {
    const poly = clipToRect(plane.poly, r);
    if (poly.length >= 3 && polygonArea(poly) > 1e-9) out.push({ poly, top: plane.top });
  }
  return out;
}

/**
 * 階の床面積: 部屋（バルコニー以外）が占める範囲の「合計」ではなく「和」を、建物外形（切り欠き後）の内側で数える。
 * 階段下のトイレのように部屋を重ねても二重に数えず、切り欠きにはみ出した分も数えない。
 */
export function floorAreaOf(b: Building, rooms: { type: string; x: number; y: number; w: number; d: number }[]): number {
  const rs = rooms.filter((r) => r.type !== "balcony");
  if (!rs.length) return 0;
  const h = 0.2275; // 半マスの半分で刻む
  const nx = Math.round(b.w / h), ny = Math.round(b.d / h);
  if (nx <= 0 || ny <= 0 || nx * ny > 40000) return rs.reduce((s, r) => s + r.w * r.d, 0);
  let n = 0;
  for (let j = 0; j < ny; j++) {
    const cy = (j + 0.5) * h;
    for (let i = 0; i < nx; i++) {
      const cx = (i + 0.5) * h;
      if (!insideFootprint(b, cx, cy)) continue;
      if (rs.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d)) n++;
    }
  }
  return n * h * h;
}

/** 道路後退がある辺の情報（図に「後退線・斜線・後退幅」を描くため）。
 *  a/b は後退線上の両端（有効敷地の頂点）、n は道路へ向かう外向きの単位ベクトル。 */
export type SetbackEdgeInfo = { index: number; setback: number; width: number; label: string; a: Pt; b: Pt; n: Pt };
export function setbackEdges(site: Site): SetbackEdgeInfo[] {
  const eff = effectiveSite(site);
  if (eff === site) return [];
  const n = site.points.length;
  const ccw = signedArea(site.points) > 0;
  return site.edges
    .filter((e) => e.road && (e.roadSetback ?? 0) > 0.001 && e.index < n)
    .map((e) => {
      const a0 = site.points[e.index];
      const b0 = site.points[(e.index + 1) % n];
      const dx = b0.x - a0.x, dy = b0.y - a0.y;
      const len = Math.hypot(dx, dy) || 1;
      const out = ccw ? { x: dy / len, y: -dx / len } : { x: -dy / len, y: dx / len };
      return { index: e.index, setback: e.roadSetback ?? 0, width: e.roadWidth ?? 4, label: e.roadLabel ?? "公道", a: eff.points[e.index], b: eff.points[(e.index + 1) % n], n: out };
    });
}
