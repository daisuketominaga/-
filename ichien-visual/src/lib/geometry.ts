import type { Pt, Site, Building, Face, Project } from "./types";

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
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    const ip = lineIntersect(prev.p, prev.d, cur.p, cur.d);
    out.push(ip ?? pts[i]);
  }
  return out;
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
  const run =
    b.roofHighSide === "N" || b.roofHighSide === "S" ? b.d : b.w;
  const rise = (run * b.roofPitchSun) / 10;
  return b.roof === "gable" ? rise / 2 : rise;
}

export const m2ToTsubo = (m2: number) => m2 / 3.30578;
export const m2ToTatami = (m2: number) => m2 / 1.62;

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
  if (view === "site") return ((base % 360) + 360) % 360;
  const deg = base + project.building.rotDeg + (project.grid?.flip ? 180 : 0);
  return ((deg % 360) + 360) % 360;
}
