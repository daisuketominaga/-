/**
 * 高さ制限の目安計算。立面図の各面に「面の左端からの位置 → 上限高さ」の関数として返す。
 * 数値・式はすべて参考。実案件は役所・確認検査機関で確認すること。
 */
import type { Project, Face, HeightRules, Building } from "./types";
import { DEFAULT_HEIGHT_RULES } from "./types";
import { clearances } from "./grid";
import { faceLength, faceNormalWorld, roofRise, facePointWorld, buildingCorners } from "./geometry";
import { baseFrame, toLocal } from "./grid";
import { KODO_PRESETS, ZONE_PRESETS } from "./heightPresets";

export const FACE_BASE: Record<Face, string> = { S: "底辺側", N: "奥側", W: "左側", E: "右側" };
const SIDES_FACE: Record<Face, [Face, Face]> = { N: ["E", "W"], S: ["W", "E"], E: ["S", "N"], W: ["N", "S"] };
const SLAB = 0.4;

/** 各階の床レベル（GLからの高さ）と最高高さ */
export function levels(b: Building) {
  const fl: number[] = [];
  let h = b.foundation + 0.1;
  for (let i = 0; i < b.floors; i++) {
    fl.push(h);
    h += b.floorHeights[i] ?? 2.3;
    if (i < b.floors - 1) h += SLAB;
  }
  const eave = h + 0.25;
  const rise = roofRise(b);
  return { fl, eave, max: eave + rise + (b.roof === "flat" ? 0.15 : 0.16) };
}

export function rulesOf(project: Project): HeightRules {
  const r = { ...DEFAULT_HEIGHT_RULES, ...(project.site.heightRules ?? {}) };
  if (!Array.isArray(r.kodoSegs)) r.kodoSegs = [];
  return r;
}

/** 用途地域を選んだときに自動で入る値 */
export function rulesFromZone(zoneId: string, far: number, prev: HeightRules): HeightRules {
  const z = ZONE_PRESETS.find((x) => x.id === zoneId);
  if (!z) return { ...prev, zoneId };
  return {
    ...prev,
    zoneId,
    roadSlope: z.residential ? 1.25 : 1.5,
    roadApplyDist: z.applyDist(far),
    northEnabled: z.lowRise || z.midRise,
    northBase: z.midRise ? 10 : 5,
    northSlope: 1.25,
    neighborEnabled: !z.lowRise,
    neighborBase: z.residential ? 20 : 31,
    neighborSlope: z.residential ? 1.25 : 2.5,
    absoluteMax: z.lowRise ? 10 : 0,
  };
}

export function rulesFromKodo(presetId: string, prev: HeightRules): HeightRules {
  const k = KODO_PRESETS.find((x) => x.id === presetId);
  if (!k) return { ...prev, kodoPresetId: presetId };
  return { ...prev, kodoPresetId: presetId, kodoEnabled: true, kodoSegs: k.segs.map((s) => ({ ...s })), kodoAbsolute: k.absoluteMax };
}

/** 区間式の評価（L: 真北方向の距離） */
export function evalSegs(segs: HeightRules["kodoSegs"], L: number): number | null {
  if (!segs.length) return null;
  for (const s of segs) if (L >= s.from - 1e-9 && (s.upTo === null || L <= s.upTo + 1e-9)) return s.base + s.slope * (L - s.from);
  const last = segs[segs.length - 1];
  return last.base + last.slope * (L - last.from);
}

export type LimitLine = { key: string; name: string; color: string; hAt: (m: number) => number | null; note: string };

/** 真北に最も向いている面 */
export function northFaceOf(project: Project): Face {
  const { site, building: b } = project;
  const nd = (site.northDeg * Math.PI) / 180;
  const north = { x: Math.sin(nd), y: Math.cos(nd) };
  const faces: Face[] = ["N", "S", "E", "W"];
  const dots = faces.map((f) => { const n = faceNormalWorld(b, f); return n.x * north.x + n.y * north.y; });
  return faces[dots.indexOf(Math.max(...dots))];
}

export type RoadInfo = {
  edgeIndex: number;
  width: number;
  /** 令132条で幅員最大の道路と同じ幅員とみなした後の幅 */
  effWidth: number;
  /** 建物の道路境界からの後退距離 */
  back: number;
  label: string;
  /** 建物のどの面が主にこの道路を向くか */
  face: Face;
};

/**
 * 前面道路ごとの情報。2以上の道路がある場合は令132条の考え方で、
 * 建物が「幅員最大の道路の境界線から幅員の2倍（35m以内）かつ他の道路の中心線から10m以内」の
 * 区域にあるとき、他の道路も幅員最大の道路と同じ幅員とみなす（戸建規模の敷地ではほぼ常に該当）。
 */
export function roadInfos(project: Project): RoadInfo[] {
  const { site, building: b } = project;
  const roads = site.edges.filter((e) => e.road && e.index < site.points.length);
  if (!roads.length) return [];
  const corners = buildingCorners(b);
  const maxW = Math.max(...roads.map((e) => e.roadWidth ?? 4));
  const maxRoad = roads.find((e) => (e.roadWidth ?? 4) === maxW)!;
  const fMax = baseFrame(site, maxRoad.index);
  const distFromMax = Math.max(...corners.map((c) => toLocal(fMax, c).y)); // 建物の最も遠い部分
  const within2A = distFromMax <= Math.min(2 * maxW, 35) + 1e-9;
  return roads.map((e) => {
    const f = baseFrame(site, e.index);
    const w = e.roadWidth ?? 4;
    const vs = corners.map((c) => toLocal(f, c).y);
    const back = Math.max(0, Math.min(...vs));
    // 他の道路の中心線からの距離 = v + w/2 が 10m 以内か
    const within10 = Math.max(...vs) + w / 2 <= 10 + 1e-9;
    const effWidth = e.index === maxRoad.index ? w : within2A && within10 ? maxW : w;
    // この道路に最も向いている面
    const a = site.points[e.index];
    const c2 = site.points[(e.index + 1) % site.points.length];
    const cx = corners.reduce((s2, p) => s2 + p.x, 0) / 4;
    const cy = corners.reduce((s2, p) => s2 + p.y, 0) / 4;
    const d = { x: (a.x + c2.x) / 2 - cx, y: (a.y + c2.y) / 2 - cy };
    let best: Face = "S";
    let bestDot = -Infinity;
    for (const fc of ["N", "S", "E", "W"] as Face[]) {
      const n = faceNormalWorld(b, fc);
      const dot = n.x * d.x + n.y * d.y;
      if (dot > bestDot) { bestDot = dot; best = fc; }
    }
    return { edgeIndex: e.index, width: w, effWidth, back, label: e.roadLabel ?? "道路", face: best };
  });
}

/** 令135条の2: 敷地が道路より 1m 以上高いときは、道路面が (h−1)/2 だけ高い位置にあるとみなす。
 *  敷地の地盤面から見た斜線の起点の高さ（負の値 = 地盤面より下）を返す */
export function roadLevelOffset(project: Project): number {
  const h = project.site.roadLevelDiff ?? 0;
  if (h < 1) return -h; // 1m 未満は緩和なし。道路面は h だけ低い
  return -(h - (h - 1) / 2);
}

export function heightLimits(project: Project, face: Face): LimitLine[] {
  const { site, building: b, grid } = project;
  const r = rulesOf(project);
  const roadEdge = site.edges.find((e) => e.road);
  const roadW = roadEdge?.roadWidth ?? 4;
  const cl = clearances(site, grid, b.w, b.d);
  const out: LimitLine[] = [];
  const len = faceLength(b, face);
  const gapTo: Record<Face, number | null> = { S: cl.bottom, N: cl.top, W: cl.left, E: cl.right };

  // 道路斜線: 前面道路ごとに、面の各点から道路境界までの距離で計算（2方向道路は令132条の幅員、高低差は令135条の2）
  const roads = roadInfos(project);
  const zOff = roadLevelOffset(project); // 道路面（みなし）の高さ。地盤面基準で負
  const back0 = cl.bottom ?? 0;
  if (!roads.length) {
    const roadLimit = (dist: number) => (roadW + back0 + dist > r.roadApplyDist ? null : r.roadSlope * (roadW + back0 + dist));
    const dist = face === "S" ? back0 : face === "N" ? back0 + b.d : 0;
    out.push({ key: "road", name: "道路斜線", color: "#c0392b", hAt: (m) => roadLimit(face === "W" ? b.d - m + back0 : face === "E" ? m + back0 : dist), note: `勾配 ${r.roadSlope}、道路幅 ${roadW}m` });
  }
  for (const rd of roads) {
    const f = baseFrame(site, rd.edgeIndex);
    const key = roads.length > 1 ? `road${rd.edgeIndex}` : "road";
    const name = roads.length > 1 ? `道路斜線(${rd.label} ${rd.effWidth}m)` : "道路斜線";
    out.push({
      key,
      name,
      color: "#c0392b",
      hAt: (m) => {
        const v = Math.max(0, toLocal(f, facePointWorld(b, face, m)).y);
        const D = rd.effWidth + rd.back + v;
        if (D > r.roadApplyDist) return null;
        return r.roadSlope * D + zOff;
      },
      note: `勾配 ${r.roadSlope}、幅員 ${rd.width}m${rd.effWidth !== rd.width ? `→令132条で ${rd.effWidth}m とみなす` : ""}、後退 ${Math.round(rd.back * 1000)}mm、適用距離 ${r.roadApplyDist}m${zOff !== 0 ? `、高低差緩和 起点 ${zOff.toFixed(2)}m` : ""}`,
    });
  }

  // 隣地斜線: 道路以外の3面。その面の境界までの距離 + 面から奥への距離
  if (r.neighborEnabled) {
    const sides: Face[] = ["N", "W", "E"];
    for (const nf of sides) {
      const gap = gapTo[nf];
      if (gap === null) continue;
      const lim = (d: number) => r.neighborBase + r.neighborSlope * (gap + d);
      const depth = nf === "N" ? b.d : b.w;
      if (face === nf) out.push({ key: "nb" + nf, name: `隣地斜線(${FACE_BASE[nf]})`, color: "#8a5a00", hAt: () => lim(0), note: `${r.neighborBase}m＋${r.neighborSlope}×距離` });
      else if (SIDES_FACE[face].includes(nf)) {
        const onLeft = SIDES_FACE[face][0] === nf;
        out.push({ key: "nb" + nf, name: `隣地斜線(${FACE_BASE[nf]})`, color: "#8a5a00", hAt: (m) => lim(onLeft ? m : len - m), note: `${r.neighborBase}m＋${r.neighborSlope}×距離` });
      } else if (face === "S" && nf === "N") {
        out.push({ key: "nb" + nf, name: `隣地斜線(${FACE_BASE[nf]})`, color: "#8a5a00", hAt: () => lim(depth), note: "" });
      }
    }
  }

  // 北側斜線・高度地区: 真北に最も向いた面から南へ
  const northFace = northFaceOf(project);
  const gap = gapTo[northFace] ?? 0;
  const depthAlong = northFace === "N" || northFace === "S" ? b.d : b.w;
  const mk = (key: string, name: string, color: string, f: (L: number) => number | null, note: string) => {
    const lim = (d: number) => f(gap + d);
    if (face === northFace) out.push({ key, name, color, hAt: () => lim(0), note });
    else if (SIDES_FACE[face].includes(northFace)) {
      const northOnLeft = SIDES_FACE[face][0] === northFace;
      out.push({ key, name, color, hAt: (m) => lim(northOnLeft ? m : len - m), note });
    } else out.push({ key, name, color, hAt: () => lim(depthAlong), note });
  };
  if (r.northEnabled) mk("north", "北側斜線", "#1d6fb8", (L) => r.northBase + r.northSlope * L, `起点 ${r.northBase}m＋勾配 ${r.northSlope}（北側の面＝${FACE_BASE[northFace]}）`);
  if (r.kodoEnabled && r.kodoSegs.length) mk("kodo", "高度地区", "#7c3aed", (L) => evalSegs(r.kodoSegs, L), `高度地区の北側斜線（北側の面＝${FACE_BASE[northFace]}）`);
  const abs = Math.min(...[r.absoluteMax, r.kodoEnabled ? r.kodoAbsolute : 0].filter((v) => v > 0));
  if (Number.isFinite(abs) && abs > 0) out.push({ key: "abs", name: "絶対高さ", color: "#b45309", hAt: () => abs, note: `${abs}m` });
  return out;
}

export type LimitCheck = { key: string; name: string; over: number; faces: Face[] };

/** 最高高さで代表して、各制限を超えている量（m）。0 なら適合 */
export function checkLimits(project: Project): LimitCheck[] {
  const b = project.building;
  const lv = levels(b);
  const byKey = new Map<string, LimitCheck>();
  for (const face of ["S", "N", "W", "E"] as Face[]) {
    const len = faceLength(b, face);
    for (const lim of heightLimits(project, face)) {
      let worst = 0;
      for (let i = 0; i <= 20; i++) {
        const h = lim.hAt((len * i) / 20);
        if (h === null) continue;
        const over = lv.max - h;
        if (over > worst) worst = over;
      }
      const cur = byKey.get(lim.key) ?? { key: lim.key, name: lim.name, over: 0, faces: [] };
      if (worst > 0.001) { cur.over = Math.max(cur.over, worst); if (!cur.faces.includes(face)) cur.faces.push(face); }
      byKey.set(lim.key, cur);
    }
  }
  return Array.from(byKey.values());
}
