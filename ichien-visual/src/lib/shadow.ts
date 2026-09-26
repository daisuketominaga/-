/**
 * 日影規制（建築基準法56条の2・別表第4、令135条の12）の参考計算。
 *
 * - 冬至日の真太陽時 8時〜16時（北海道以外）について、5分刻みで建物の影を測定面（平均地盤面＋1.5/4/6.5m）に落とし、
 *   敷地境界線（道路・水面等に接する辺は幅の1/2だけ外側、幅10m超なら反対側から5m敷地側）から
 *   5m超〜10m以内、10m超 の範囲で日影時間の最大値を求める。
 * - 建物は屋根面ごとの「上面が平面の凸多角形立体」に分け、各立体の影 = 測定面より上の部分の頂点と、
 *   その頂点を太陽と反対方向へ (高さ−測定面高さ)/tan(太陽高度) だけ動かした点の凸包。
 * - 軒の出は屋根面を延長して含める。母屋下がりは無視（影を大きめに見る＝安全側）。
 * - 太陽位置は冬至の赤緯 −23.44°、緯度は入力値。均時差・大気差は真太陽時基準のため考慮しない。
 * - 敷地内の日影は規制の対象外。隣地の建物や地盤の高低差は考慮しない。
 *
 * ★参考値です。確認申請の日影図は設計事務所・確認検査機関のソフトで作成してください。
 */
import type { Pt, Project, Building } from "./types";
import { buildingSolids, buildingToWorld, polygonArea, distToSegment, pointInPolygon, signedArea } from "./geometry";
import { levels, rulesOf } from "./heightLimits";
import { roofRise } from "./geometry";

export type ShadowResult = {
  /** 規制の対象（高さ条件を満たす）か */
  target: boolean;
  targetNote: string;
  planeH: number;
  hours5: number;
  hours10: number;
  /** 5m超10m以内・10m超 それぞれの最大日影時間と位置 */
  band5: { max: number; at: Pt | null; ok: boolean };
  band10: { max: number; at: Pt | null; ok: boolean };
  ok: boolean;
  /** みなし敷地境界（道路等の 1/2 外側）と 5m/10m の線（表示用、ミター結合） */
  lines: { boundary: Pt[]; l5: Pt[]; l10: Pt[] };
  /** 日影時間のサンプル（表示用）。敷地の外で 0h 超の点 */
  samples: { x: number; y: number; h: number; band: 0 | 5 | 10 }[];
  step: number;
  /** 太陽位置のログ（時刻, 高度°, 方位°） */
  sun: { t: number; alt: number; az: number }[];
  note: string[];
};

const DECL = (-23.44 * Math.PI) / 180;

/** 真太陽時 t（時）の太陽。世界座標（x=画面右, y=画面上）での「影の向き」と「高さ1あたりの影の長さ」 */
function sunAt(t: number, latDeg: number, northDeg: number) {
  const phi = (latDeg * Math.PI) / 180;
  const H = ((t - 12) * 15 * Math.PI) / 180;
  const E = -Math.cos(DECL) * Math.sin(H);
  const N = Math.sin(DECL) * Math.cos(phi) - Math.cos(DECL) * Math.sin(phi) * Math.cos(H);
  const U = Math.sin(DECL) * Math.sin(phi) + Math.cos(DECL) * Math.cos(phi) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, U)));
  const nd = (northDeg * Math.PI) / 180;
  const north = { x: Math.sin(nd), y: Math.cos(nd) };
  const east = { x: Math.cos(nd), y: -Math.sin(nd) };
  const hx = E * east.x + N * north.x;
  const hy = E * east.y + N * north.y;
  const hl = Math.hypot(hx, hy) || 1;
  // 影は太陽と反対向き
  return { alt, az: ((Math.atan2(E, N) * 180) / Math.PI + 360) % 360, dir: { x: -hx / hl, y: -hy / hl }, lenPerH: U > 1e-6 ? hl / U : Infinity };
}

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

/** 凸多角形（反時計回り）の内側か */
function inConvex(poly: Pt[], p: Pt): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < -1e-9) return false;
  }
  return true;
}

/** 多角形を外側へ dist だけ広げる（ミター結合。表示用） */
export function offsetPolygonOut(pts: Pt[], dist: number): Pt[] {
  const n = pts.length;
  if (n < 3 || dist <= 0) return pts;
  const ccw = signedArea(pts) > 0;
  const lines: { p: Pt; d: Pt }[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = ccw ? dy / len : -dy / len; // 外向き
    const ny = ccw ? -dx / len : dx / len;
    lines.push({ p: { x: a.x + nx * dist, y: a.y + ny * dist }, d: { x: dx, y: dy } });
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n], cur = lines[i];
    const det = prev.d.x * cur.d.y - prev.d.y * cur.d.x;
    if (Math.abs(det) < 1e-9) { out.push(cur.p); continue; }
    const t = ((cur.p.x - prev.p.x) * cur.d.y - (cur.p.y - prev.p.y) * cur.d.x) / det;
    out.push({ x: prev.p.x + prev.d.x * t, y: prev.p.y + prev.d.y * t });
  }
  return out;
}

/** 令135条の12: 道路・水面等に接する辺を幅の 1/2 だけ外側へ（10m 超なら反対側から 5m 敷地側） */
export function deemedBoundary(project: Project): Pt[] {
  const { site } = project;
  const n = site.points.length;
  const ccw = signedArea(site.points) > 0;
  const shift = site.points.map(() => 0);
  for (const e of site.edges) if (e.road && e.index < n) { const w = e.roadWidth ?? 4; shift[e.index] = w > 10 ? w - 5 : w / 2; }
  const lines = site.points.map((a, i) => {
    const b = site.points[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = ccw ? dy / len : -dy / len, ny = ccw ? -dx / len : dx / len;
    return { p: { x: a.x + nx * shift[i], y: a.y + ny * shift[i] }, d: { x: dx, y: dy } };
  });
  return site.points.map((_, i) => {
    const prev = lines[(i - 1 + n) % n], cur = lines[i];
    const det = prev.d.x * cur.d.y - prev.d.y * cur.d.x;
    if (Math.abs(det) < 1e-9) return cur.p;
    const t = ((cur.p.x - prev.p.x) * cur.d.y - (cur.p.y - prev.p.y) * cur.d.x) / det;
    return { x: prev.p.x + prev.d.x * t, y: prev.p.y + prev.d.y * t };
  });
}

/** 軒の出ぶん外形を広げた仮想の建物（屋根面を延長。母屋下がりは落とす） */
function withEaves(b: Building, e: number): { bv: Building; eave: number; rise: number; max: number } {
  const lv = levels(b);
  if (e <= 0 || b.roof === "flat") return { bv: { ...b, roofDrop: {} }, eave: lv.eave, rise: roofRise(b), max: lv.max };
  const pitch = b.roofPitchSun / 10;
  const bv: Building = { ...b, w: b.w + 2 * e, d: b.d + 2 * e, roofDrop: {}, notches: (b.notches ?? []).map((n) => ({ ...n, w: n.w - e, d: n.d - e })).filter((n) => n.w > 0 && n.d > 0) };
  return { bv, eave: lv.eave - pitch * e, rise: roofRise(bv), max: lv.max };
}

export function checkShadow(project: Project, step = 0.5): ShadowResult | { error: string } {
  const r = rulesOf(project);
  const b = project.building;
  const lv = levels(b);
  const planeH = r.shadowPlaneH ?? 4;
  const hours5 = r.shadowHours5 ?? 4;
  const hours10 = r.shadowHours10 ?? 2.5;
  const lat = r.latitude ?? 35.45;
  const note: string[] = [];
  const target = (r.shadowTarget ?? "h10") === "eave7" ? lv.eave > 7 + 1e-9 || b.floors >= 3 : lv.max > 10 + 1e-9;
  const targetNote = (r.shadowTarget ?? "h10") === "eave7" ? `軒高 ${lv.eave.toFixed(2)}m（7m 超で対象）・${b.floors} 階（3 階以上で対象）` : `最高高さ ${lv.max.toFixed(2)}m（10m 超で対象）`;
  if (lv.max <= planeH) return { error: "建物が測定面より低いので影が出ません" };

  // 立体（世界座標）。軒の出を含める
  const e = Math.max(0, b.eaveOverhang ?? 0);
  const { bv, eave, rise, max } = withEaves(b, e);
  const solids = buildingSolids(bv, eave, rise, max).map((s) => ({
    poly: s.poly.map((p) => buildingToWorld(b, { x: p.x - e, y: p.y - e })),
    tops: s.poly.map((p) => s.top(p.x, p.y)),
  }));
  if (b.roofDrop && Object.values(b.roofDrop).some((v) => v && v > 0)) note.push("母屋下がりは無視（影を大きめに見る＝安全側）");

  // 時刻ごとの影（凸多角形の集合）
  const times: number[] = [];
  const dt = 5 / 60;
  for (let t = 8 + dt / 2; t < 16; t += dt) times.push(t);
  const sun = times.map((t) => ({ t, ...sunAt(t, lat, project.site.northDeg) }));
  const shadows: Pt[][][] = sun.map((s) => {
    if (s.alt <= 0) return [];
    const out: Pt[][] = [];
    for (const sd of solids) {
      // 測定面より上の部分だけ（上面は平面なので頂点の値で線形補間して切る）
      const pts: Pt[] = [];
      const n = sd.poly.length;
      for (let i = 0; i < n; i++) {
        const a = sd.poly[i], c = sd.poly[(i + 1) % n];
        const fa = sd.tops[i] - planeH, fc = sd.tops[(i + 1) % n] - planeH;
        const push = (p: Pt, f: number) => { pts.push(p); pts.push({ x: p.x + s.dir.x * f * s.lenPerH, y: p.y + s.dir.y * f * s.lenPerH }); };
        if (fa >= 0) push(a, fa);
        if ((fa >= 0) !== (fc >= 0)) { const u = fa / (fa - fc); push({ x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u }, 0); }
      }
      if (pts.length >= 3) { const h = convexHull(pts); if (h.length >= 3 && polygonArea(h) > 1e-9) out.push(h); }
    }
    return out;
  });

  // みなし境界と測定範囲
  const boundary = deemedBoundary(project);
  const lines = { boundary, l5: offsetPolygonOut(boundary, 5), l10: offsetPolygonOut(boundary, 10) };
  const nB = boundary.length;
  const distToBoundary = (p: Pt) => { let m = Infinity; for (let i = 0; i < nB; i++) m = Math.min(m, distToSegment(p, boundary[i], boundary[(i + 1) % nB])); return pointInPolygon(p, boundary) ? -m : m; };
  // 格子の範囲: 影の範囲 ∪ 敷地
  const all = shadows.flat(2).concat(boundary);
  const minX = Math.min(...all.map((p) => p.x)) - step, maxX = Math.max(...all.map((p) => p.x)) + step;
  const minY = Math.min(...all.map((p) => p.y)) - step, maxY = Math.max(...all.map((p) => p.y)) + step;
  const samples: ShadowResult["samples"] = [];
  const band5 = { max: 0, at: null as Pt | null, ok: true };
  const band10 = { max: 0, at: null as Pt | null, ok: true };
  // 影の bbox で早めに間引く
  const sbox = shadows.map((polys) => polys.map((poly) => ({ poly, minX: Math.min(...poly.map((p) => p.x)), maxX: Math.max(...poly.map((p) => p.x)), minY: Math.min(...poly.map((p) => p.y)), maxY: Math.max(...poly.map((p) => p.y)) })));
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      const p = { x, y };
      const d = distToBoundary(p);
      if (d <= 0) continue; // 敷地内は対象外
      let cnt = 0;
      for (const polys of sbox) {
        for (const s of polys) {
          if (x < s.minX || x > s.maxX || y < s.minY || y > s.maxY) continue;
          if (inConvex(s.poly, p)) { cnt++; break; }
        }
      }
      if (!cnt) continue;
      const h = cnt * dt;
      const band: 0 | 5 | 10 = d > 10 ? 10 : d > 5 ? 5 : 0;
      samples.push({ x, y, h: Math.round(h * 100) / 100, band });
      if (band === 5 && h > band5.max) { band5.max = h; band5.at = p; }
      if (band === 10 && h > band10.max) { band10.max = h; band10.at = p; }
    }
  }
  band5.ok = band5.max <= hours5 + 1e-9;
  band10.ok = band10.max <= hours10 + 1e-9;
  return {
    target,
    targetNote,
    planeH,
    hours5,
    hours10,
    band5,
    band10,
    ok: !target || (band5.ok && band10.ok),
    lines,
    samples,
    step,
    sun: sun.filter((_, i) => i % 12 === 0).map((s) => ({ t: Math.round(s.t * 100) / 100, alt: Math.round((s.alt * 180) / Math.PI * 10) / 10, az: Math.round(s.az * 10) / 10 })),
    note,
  };
}
