"use client";

import { useMemo, useRef, useState } from "react";
import type { GridSetting, Notch, Project, Pt } from "@/lib/types";
import { HALF, MODULE, TSUBO_M2 } from "@/lib/types";
import { insetPolygon, round, northScreenDeg, footprintArea, notchesOf, footprintPolygon, siteAreaOf, effectiveSite, setbackEdges, setbackStripArea, pointInPolygon, insideFootprint } from "@/lib/geometry";
import { baseFrame, toLocal, toWorld, buildingFromGrid, maxRect, footprintFits, maxStair, modules, clearancesMin, roadBands, cellsToShape } from "@/lib/grid";
import { downloadSvgAsPng } from "@/lib/store";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
  /** 印刷用: 図だけを描く */
  readOnly?: boolean;
};

const PX = 44;

const CORNER_LABEL: Record<Notch["corner"], string> = { SW: "底辺側・左の角", SE: "底辺側・右の角", NE: "奥・右の角", NW: "奥・左の角" };

export default function BuildableGrid({ project, setProject, readOnly }: Props) {
  const { grid, building } = project;
  // 道路後退（2項道路のセットバック）を差し引いた有効敷地で考える
  const site = useMemo(() => effectiveSite(project.site), [project.site]);
  const svgRef = useRef<SVGSVGElement>(null);
  const flip = !!grid.flip;

  const unit = grid.unit && grid.unit > 0 ? grid.unit : HALF;
  const snap = (v: number) => round(Math.round(v / unit) * unit, 4);
  /** 基準値 base の端数（unit で割った余り）を保って丸める */
  const snapKeep = (v: number, base: number) => { const ph = base - Math.round(base / unit) * unit; return round(Math.round((v - ph) / unit) * unit + ph, 4); };
  const frame = useMemo(() => baseFrame(site, grid.baseEdge), [site, grid.baseEdge]);
  const setback = site.fireproofException ? 0 : site.setback;
  const inner = useMemo(() => (setback > 0 ? insetPolygon(site.points, setback) : site.points), [site.points, setback]);
  const loc = site.points.map((p) => toLocal(frame, p));
  const innerLoc = inner.map((p) => toLocal(frame, p));
  // 道路後退（セットバック）: 後退前の境界線と後退部分を図に残す
  const origLoc = project.site.points.map((p) => toLocal(frame, p));
  const sbEdges = useMemo(() => setbackEdges(project.site), [project.site]);
  const stripArea = useMemo(() => setbackStripArea(project.site), [project.site]);
  const rotN = (n: { x: number; y: number }) => ({ x: n.x * frame.t.x + n.y * frame.t.y, y: n.x * frame.n.x + n.y * frame.n.y });

  // 道路帯（底辺座標）
  const roadW = Math.min(6, Math.max(0, ...site.edges.filter((e) => e.road).map((e) => e.roadWidth ?? 4)));
  const roads = roadBands(site, frame, 6);

  const allU = [...loc.map((p) => p.x), ...roads.flatMap((r) => r.poly.map((p) => p.x))];
  const allV = [...loc.map((p) => p.y), ...origLoc.map((p) => p.y), ...roads.flatMap((r) => r.poly.map((p) => p.y))];
  const minU = Math.min(...loc.map((p) => p.x), ...origLoc.map((p) => p.x)) - 1.5;
  const maxU = Math.max(...loc.map((p) => p.x), ...origLoc.map((p) => p.x)) + 1.5;
  const minV = Math.min(-1.5, Math.min(...allV) - 0.3, -roadW - 0.6);
  const maxV = Math.max(...loc.map((p) => p.y), ...origLoc.map((p) => p.y)) + 1.5;
  void allU;
  const W = (maxU - minU) * PX;
  const H = (maxV - minV) * PX;
  // 反転時は180度回転（底辺が上）
  const X = (u: number) => (flip ? (maxU - u) * PX : (u - minU) * PX);
  const Y = (v: number) => (flip ? (v - minV) * PX : (maxV - v) * PX);

  const fits = footprintFits(frame, inner, grid, building);
  const area = siteAreaOf(project.site);
  const bArea = footprintArea(building);
  const notches = notchesOf(building);
  const coverage = (bArea / area) * 100;
  // 境界までの距離は、切り欠き後の外形の輪郭から方向ごとに一番近いところを取る
  const clm = useMemo(() => clearancesMin(site, grid, building), [site, grid, building]);
  const cl = { bottom: clm.bottom?.d ?? null, top: clm.top?.d ?? null, left: clm.left?.d ?? null, right: clm.right?.d ?? null };

  // 北の向き（画面上、上から時計回り）。敷地図で決めた1つの値から計算
  const northLocalDeg = northScreenDeg(project, "plan");

  const apply = (patch: { u?: number; v?: number; w?: number; d?: number; baseEdge?: number; flip?: boolean }) =>
    setProject((p) => {
      const g = {
        ...p.grid,
        paint: undefined, // 枠を手で動かしたら塗りマスは建物から作り直す
        ...(patch.baseEdge !== undefined ? { baseEdge: patch.baseEdge } : {}),
        ...(patch.flip !== undefined ? { flip: patch.flip } : {}),
        // 位置は「今の位置の端数（離れ線に揃えた 0.6 など）」を保ったまま unit 刻みで動かす
        ...(patch.u !== undefined ? { u: snapKeep(patch.u, p.grid.u) } : {}),
        ...(patch.v !== undefined ? { v: snapKeep(patch.v, p.grid.v) } : {}),
      };
      const w = patch.w !== undefined ? Math.max(unit, snap(patch.w)) : p.building.w;
      const d = patch.d !== undefined ? Math.max(unit, snap(patch.d)) : p.building.d;
      return { ...p, grid: g, building: buildingFromGrid(p.site, g, w, d, p.building) };
    });

  const setNotches = (notches: Notch[]) => setProject((p) => ({ ...p, building: { ...p.building, notches } }));

  /** 階段状の最大範囲: 底辺を離れ線に揃え、入るマスを全部拾う */
  /** 離れ線の左端（底辺の1マス目の高さでの u）。ここにマスの境界を合わせると、左も離れ線ぴったりになる */
  const leftEdgeU = (vAt?: number) => {
    const v = vAt ?? setback + unit / 2;
    let best = Infinity;
    for (let i = 0; i < innerLoc.length; i++) {
      const a = innerLoc[i], c = innerLoc[(i + 1) % innerLoc.length];
      if ((a.y <= v && c.y >= v) || (c.y <= v && a.y >= v)) {
        if (Math.abs(c.y - a.y) < 1e-9) { best = Math.min(best, a.x, c.x); continue; }
        const t = (v - a.y) / (c.y - a.y);
        best = Math.min(best, a.x + (c.x - a.x) * t);
      }
    }
    return Number.isFinite(best) ? best : grid.u;
  };
  const autoStair = () => {
    const u0 = leftEdgeU();
    const r = maxStair(site, grid.baseEdge, setback, ((u0 % unit) + unit) % unit, unit);
    if (r.cells === 0) {
      alert(`離れ線の内側に${Math.round(unit * 1000)}mm角が1つも入りません。離れの設定か境界点を確認してください。`);
      return;
    }
    setProject((p) => {
      const g = { ...p.grid, u: r.u, v: r.v, paint: undefined };
      return { ...p, grid: g, building: { ...buildingFromGrid(p.site, g, r.w, r.d, p.building), notches: r.notches } };
    });
  };

  /** 枠を離れ線にぴったり寄せる（左／右／奥／手前）。離れ線の内側に収まる範囲で、その向きへ最大まで動かす（1mm 刻み） */
  const pushTo = (dir: "left" | "right" | "far" | "near") => {
    const g0 = { ...grid };
    const fitsAt = (t: number) => {
      const g = { ...g0, u: dir === "left" ? g0.u - t : dir === "right" ? g0.u + t : g0.u, v: dir === "far" ? g0.v + t : dir === "near" ? g0.v - t : g0.v };
      return footprintFits(frame, inner, g, building);
    };
    if (!fitsAt(0)) { setCellHint("今の枠が離れ線からはみ出しているので、先に内側へ動かしてください。"); return; }
    let lo = 0, hi = 0.001;
    while (hi < 20 && fitsAt(hi)) { lo = hi; hi *= 2; }
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (fitsAt(m)) lo = m; else hi = m; }
    const t = Math.floor(lo * 1000) / 1000;
    setProject((p) => {
      const g = { ...p.grid, paint: undefined, u: round(dir === "left" ? p.grid.u - t : dir === "right" ? p.grid.u + t : p.grid.u, 4), v: round(dir === "far" ? p.grid.v + t : dir === "near" ? p.grid.v - t : p.grid.v, 4) };
      return { ...p, grid: g, building: buildingFromGrid(p.site, g, p.building.w, p.building.d, p.building) };
    });
  };

  const autoMax = () => {
    const best = maxRect(site, grid.baseEdge, setback);
    if (best.area === 0) {
      alert(`離れ線の内側に${Math.round(unit * 1000)}mm角が1つも入りません。離れの設定か境界点を確認してください。`);
      return;
    }
    apply({ u: best.u, v: best.v, w: best.w, d: best.d });
  };

  // ---- ドラッグ操作（移動・辺の伸縮・マスの追加/削除）
  const [mode, setMode] = useState<"move" | "cells">("move");
  const dragRef = useRef<
    | { kind: "move"; su: number; sv: number; ou: number; ov: number }
    | { kind: "edge"; edge: "left" | "right" | "top" | "bottom"; su: number; sv: number; ou: number; ov: number; ow: number; od: number }
    | { kind: "cells"; add: boolean; cells: Set<string>; ou: number; ov: number; last: string }
    | { kind: "corner"; corner: Notch["corner"]; ou: number; ov: number; ow: number; od: number }
    | null
  >(null);
  const pointerToUV = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { u: flip ? maxU - pt.x / PX : minU + pt.x / PX, v: flip ? minV + pt.y / PX : maxV - pt.y / PX };
  };
  /** 塗ったマスを保存し、そこから建物（外接する枠＋角の切り欠き）を作り直す。マスが 0 なら建物はそのまま */
  const applyCells = (cells: Set<string>, ou: number, ov: number) => {
    const r = cellsToShape(cells, unit);
    setProject((p) => {
      const paint = { u: round(ou, 4), v: round(ov, 4), unit, cells: Array.from(cells), setback };
      if (!r.cells) return { ...p, grid: { ...p.grid, paint } };
      const g = { ...p.grid, u: round(ou + r.u, 4), v: round(ov + r.v, 4), paint };
      return { ...p, grid: g, building: { ...buildingFromGrid(p.site, g, r.w, r.d, p.building), notches: r.notches } };
    });
  };
  const cellKeyAt = (uv: { u: number; v: number }, ou: number, ov: number) => `${Math.floor((uv.u - ou) / unit)},${Math.floor((uv.v - ov) / unit)}`;
  /** マス（列 i・行 j、原点 ou,ov）が離れ線の内側に完全に入るか（4隅を 1mm 内側に寄せて判定） */
  const cellOk = (i: number, j: number, ou: number, ov: number) => {
    const e = 0.0001; // 0.1mm だけ内側に寄せて判定（離れ線ぴったりのマスは入る。599mm のような不足は出ない）
    const u0 = ou + i * unit, v0 = ov + j * unit;
    return [[u0 + e, v0 + e], [u0 + unit - e, v0 + e], [u0 + e, v0 + unit - e], [u0 + unit - e, v0 + unit - e]].every(([u, v]) => pointInPolygon(toWorld(frame, { x: u, y: v }), inner));
  };
  const [cellHint, setCellHint] = useState<string | null>(null);
  /** 塗りマスの原点と一覧。未設定なら「離れ線の角」を原点に、今の建物に入っているマスを塗った状態から始める */
  const paint = useMemo(() => {
    // 離れの値が変わっていたら原点を取り直す（古い離れ線の角のままだと 600 にならない）
    if (grid.paint && Math.abs(grid.paint.unit - unit) < 1e-9 && (grid.paint.setback === undefined || Math.abs(grid.paint.setback - setback) < 1e-9)) return { u: grid.paint.u, v: grid.paint.v, cells: new Set(grid.paint.cells) };
    const ou = leftEdgeU(), ov = setback;
    const cells = new Set<string>();
    const us = loc.map((p) => p.x), vs = loc.map((p) => p.y);
    const i0 = Math.floor((Math.min(...us) - ou) / unit) - 1, i1 = Math.ceil((Math.max(...us) - ou) / unit) + 1;
    const j0 = Math.floor((Math.min(...vs) - ov) / unit) - 1, j1 = Math.ceil((Math.max(...vs) - ov) / unit) + 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const cu = ou + (i + 0.5) * unit, cv = ov + (j + 0.5) * unit;
      if (insideFootprint(building, cu - grid.u, cv - grid.v)) cells.add(`${i},${j}`);
    }
    return { u: ou, v: ov, cells };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid.paint, unit, setback, building, grid.u, grid.v, innerLoc]);
  /** 塗ったマスのうち、階段形に丸めた結果の建物に入っていないもの（橙で表示） */
  const droppedCells = useMemo(() => {
    const out = new Set<string>();
    for (const k of paint.cells) {
      const [i, j] = k.split(",").map(Number);
      const cu = paint.u + (i + 0.5) * unit, cv = paint.v + (j + 0.5) * unit;
      if (!insideFootprint(building, cu - grid.u, cv - grid.v)) out.add(k);
    }
    return out;
  }, [paint, building, grid.u, grid.v, unit]);
  /** 原点を離れ線の角に戻す／半マスずらす（マスは塗り直し） */
  const resetPaint = (du = 0, dv = 0) => {
    const ou = round(paint.u + du, 4), ov = round(paint.v + dv, 4);
    setProject((p) => ({ ...p, grid: { ...p.grid, paint: { u: ou, v: ov, unit, cells: [], setback } } }));
    setCellHint(null);
  };
  /** 囲った中を塗りつぶす: 塗ったマスに囲まれて外へ出られない未塗りマスと、両隣（左右または上下）が塗られている1マスの隙間を塗る（離れ線の内側だけ） */
  const fillEnclosed = () => {
    if (paint.cells.size === 0) { setCellHint("先にいくつかマスを塗ってから押してください。"); return; }
    const cells = new Set(paint.cells);
    const idx = Array.from(cells).map((k) => k.split(",").map(Number));
    const i0 = Math.min(...idx.map((c) => c[0])) - 1, i1 = Math.max(...idx.map((c) => c[0])) + 1;
    const j0 = Math.min(...idx.map((c) => c[1])) - 1, j1 = Math.max(...idx.map((c) => c[1])) + 1;
    // 外側（枠の1つ外）から到達できる未塗りマスに印を付ける
    const outside = new Set<string>();
    const stack: [number, number][] = [[i0, j0]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      const k = `${i},${j}`;
      if (i < i0 || i > i1 || j < j0 || j > j1 || outside.has(k) || cells.has(k)) continue;
      outside.add(k);
      stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
    }
    let added = 0, skipped = 0;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = `${i},${j}`;
      if (cells.has(k) || outside.has(k)) continue;
      if (cellOk(i, j, paint.u, paint.v)) { cells.add(k); added++; } else skipped++;
    }
    // 1マスの隙間（左右または上下が塗られている）も埋める
    for (let pass = 0; pass < 2; pass++) for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = `${i},${j}`;
      if (cells.has(k)) continue;
      const lr = cells.has(`${i - 1},${j}`) && cells.has(`${i + 1},${j}`);
      const ud = cells.has(`${i},${j - 1}`) && cells.has(`${i},${j + 1}`);
      if ((lr || ud) && cellOk(i, j, paint.u, paint.v)) { cells.add(k); added++; }
    }
    applyCells(cells, paint.u, paint.v);
    setCellHint(added || skipped ? `${added} マスを塗りつぶしました。${skipped ? `${skipped} マスは離れ線の外なので塗っていません。` : ""}` : "塗りつぶす隙間はありませんでした。");
  };
  /** 塗ったマスごと原点をずらして、その方向の一番近いところが離れ（600mm など）ぴったりになるようにする */
  const alignPaint = (side: "left" | "right" | "bottom" | "top") => {
    const c = clm[side];
    if (!c) { setCellHint("その方向の境界が見つかりません。"); return; }
    const delta = round(setback - c.d, 4); // 正なら境界から遠ざける向きに動かす
    if (Math.abs(delta) < 0.0005) { setCellHint("すでにぴったりです。"); return; }
    const du = side === "left" ? delta : side === "right" ? -delta : 0;
    const dv = side === "bottom" ? delta : side === "top" ? -delta : 0;
    applyCells(new Set(paint.cells), round(paint.u + du, 4), round(paint.v + dv, 4));
    setCellHint(`${side === "left" ? "左" : side === "right" ? "右" : side === "bottom" ? "底辺側" : "奥"}の一番近いところを ${Math.round(setback * 1000)}mm に揃えました（${Math.round(Math.abs(delta) * 1000)}mm 移動）。ほかの方向の距離も確認してください。`);
  };
  /** 塗ったマスのうち、今の原点では離れ線の外に出ているもの（赤で表示） */
  const outCells = useMemo(() => {
    const out = new Set<string>();
    for (const k of paint.cells) { const [i, j] = k.split(",").map(Number); if (!cellOk(i, j, paint.u, paint.v)) out.add(k); }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint, inner, unit]);
  /** 離れ線（多角形）を u=at の縦線／v=at の横線で切ったときの範囲 [min, max]（底辺座標） */
  const extentAt = (axis: "u" | "v", at: number): [number, number] | null => {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < innerLoc.length; k++) {
      const a = innerLoc[k], c = innerLoc[(k + 1) % innerLoc.length];
      const a1 = axis === "v" ? a.y : a.x, c1 = axis === "v" ? c.y : c.x;
      const a2 = axis === "v" ? a.x : a.y, c2 = axis === "v" ? c.x : c.y;
      if ((a1 <= at && c1 >= at) || (c1 <= at && a1 >= at)) {
        if (Math.abs(c1 - a1) < 1e-9) { lo = Math.min(lo, a2, c2); hi = Math.max(hi, a2, c2); continue; }
        const t = (at - a1) / (c1 - a1);
        const x = a2 + (c2 - a2) * t;
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    }
    return Number.isFinite(lo) ? [lo, hi] : null;
  };
  /** 範囲 [r0, r1] の中で離れ線が一番内側に来る位置（side: どちら側の境界か）。
   *  離れ線は直線の辺なので、極値は範囲の両端か、範囲内にある頂点のどれか */
  const innermost = (side: "left" | "right" | "bottom" | "top", r0: number, r1: number): number | null => {
    const axis = side === "left" || side === "right" ? "v" : "u";
    const cands = [r0, r1, ...innerLoc.map((p) => (axis === "v" ? p.y : p.x)).filter((c) => c > r0 && c < r1)];
    let best: number | null = null;
    for (const t of cands) {
      const ex = extentAt(axis, t);
      if (!ex) continue;
      const x = side === "left" || side === "bottom" ? ex[0] : ex[1];
      if (best === null) best = x;
      else best = side === "left" || side === "bottom" ? Math.max(best, x) : Math.min(best, x);
    }
    return best;
  };
  const anchor = grid.anchor ?? "SW";
  const stepFull = grid.stepFull ?? true;
  const anchorName = (c: NonNullable<GridSetting["anchor"]>) => (c === "SW" ? "左下（底辺側・左）" : c === "NW" ? "左上（奥・左）" : c === "NE" ? "右上（奥・右）" : "右下（底辺側・右）");
  /** 基点の角を離れ線の角（境界から setback）にぴったり合わせ、そこから離れ線いっぱいまで広げる。
   *  奥行（行数）は今の建物のまま。左右は基点の側から、境界なりの階段（stepFull なら 910mm 刻み）で伸ばす */
  const snugFromAnchor = () => {
    const rows = Math.max(1, Math.round(building.d / unit));
    const left = anchor === "SW" || anchor === "NW", bottom = anchor === "SW" || anchor === "SE";
    const B = stepFull && Math.abs(unit - 0.455) < 1e-6 ? 2 : 1; // 階段の刻み（マス数）
    const bw = B * unit; // 基点の角の1ブロック分
    // 基点の角のところで、境界（離れ線）にぴったり合わせる。測るのは基点の角の1ブロック分の範囲だけ
    // （建物の幅全体で測ると、反対側の斜めの境界に引っ張られて基点が 600mm にならない）。範囲は結果に依存するので繰り返す
    // 出発点は、離れ線の頂点のうち基点の向きに一番寄っている角（左上なら v−u が最大の頂点）
    const score = (q: Pt) => (left ? -q.x : q.x) + (bottom ? -q.y : q.y);
    const start = innerLoc.reduce((a, b) => (score(b) > score(a) ? b : a));
    let u0 = start.x, v0 = start.y; // 基点の角の位置
    for (let it = 0; it < 4; it++) {
      const ve = innermost(bottom ? "bottom" : "top", left ? u0 : u0 - bw, left ? u0 + bw : u0);
      if (ve === null) { setCellHint("この位置では離れ線が見つかりません。建物を敷地の中へ動かしてください。"); return; }
      v0 = ve;
      const ue = innermost(left ? "left" : "right", bottom ? v0 : v0 - bw, bottom ? v0 + bw : v0);
      if (ue === null) { setCellHint("この位置では離れ線が見つかりません。建物を敷地の中へ動かしてください。"); return; }
      u0 = ue;
    }
    // マスの原点: 基点の角がちょうど (ou, ov) / (ou + K·unit, ov) / (…, ov + rows·unit) に来るように
    const K = 80; // 右基点のときの列数の上限（十分大きく）
    const ou = round(left ? u0 : u0 - K * unit, 4);
    const ov = round(bottom ? v0 : v0 - rows * unit, 4);
    const cells = new Set<string>();
    // 行のブロック: 基点側から並べる
    const rowBlocks: number[][] = [];
    if (bottom) { for (let j = 0; j < rows; j += B) rowBlocks.push(Array.from({ length: Math.min(B, rows - j) }, (_, k) => j + k)); }
    else { for (let j = rows - 1; j >= 0; j -= B) rowBlocks.push(Array.from({ length: Math.min(B, j + 1) }, (_, k) => j - k)); }
    let stoppedRows = 0;
    for (const rb of rowBlocks) {
      // 列のブロック: 基点側から外へ
      // 基点側の境界が斜めで、その行は基点の列に入らないこともある。その場合は入る列まで内側へずらして始める（基点側も階段になる）
      let placed = 0;
      for (let c = 0; c < K; c += B) {
        const cols = left ? Array.from({ length: B }, (_, k) => c + k) : Array.from({ length: B }, (_, k) => K - 1 - c - k);
        const ok = cols.every((i) => rb.every((j) => cellOk(i, j, ou, ov)));
        if (!ok) { if (placed) break; if (c > 12 * B) break; continue; }
        for (const i of cols) for (const j of rb) cells.add(`${i},${j}`);
        placed++;
      }
      if (!placed) { stoppedRows += rb.length; }
    }
    if (!cells.size) { setCellHint("この奥行の位置では、離れ線の内側にマスが入りません。"); return; }
    applyCells(cells, ou, ov);
    setCellHint(`基点「${anchorName(anchor)}」を離れ線の角（境界から ${Math.round(setback * 1000)}mm）に合わせ、${B === 2 ? "910mm" : `${Math.round(unit * 1000)}mm`} 刻みの階段で離れ線いっぱいまで広げました。${stoppedRows ? `${stoppedRows} 行は入らなかったので減らしています。` : ""}`);
  };
  const paintAll = () => {
    // 離れ線の内側に丸ごと入るマスを全部塗る
    const cells = new Set<string>();
    const us = loc.map((p) => p.x), vs = loc.map((p) => p.y);
    const i0 = Math.floor((Math.min(...us) - paint.u) / unit) - 1, i1 = Math.ceil((Math.max(...us) - paint.u) / unit) + 1;
    const j0 = Math.floor((Math.min(...vs) - paint.v) / unit) - 1, j1 = Math.ceil((Math.max(...vs) - paint.v) / unit) + 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (cellOk(i, j, paint.u, paint.v)) cells.add(`${i},${j}`);
    applyCells(cells, paint.u, paint.v);
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const uv = pointerToUV(e);
    const target = e.target as SVGElement;
    const handle = target.getAttribute("data-handle") as "left" | "right" | "top" | "bottom" | null;
    if (mode === "cells") {
      const cells = new Set(paint.cells);
      const key = cellKeyAt(uv, paint.u, paint.v);
      const add = !cells.has(key);
      const [ci, cj] = key.split(",").map(Number);
      if (add && !cellOk(ci, cj, paint.u, paint.v)) { setCellHint(`このマスは離れ線（境界から ${Math.round(setback * 1000)}mm）の外なので選べません。`); return; }
      setCellHint(null);
      if (add) cells.add(key); else cells.delete(key);
      dragRef.current = { kind: "cells", add, cells, ou: paint.u, ov: paint.v, last: key };
      applyCells(cells, paint.u, paint.v);
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    const cornerAttr = target.getAttribute("data-corner") as Notch["corner"] | null;
    if (cornerAttr) {
      dragRef.current = { kind: "corner", corner: cornerAttr, ou: grid.u, ov: grid.v, ow: building.w, od: building.d };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (handle) {
      dragRef.current = { kind: "edge", edge: handle, su: uv.u, sv: uv.v, ou: grid.u, ov: grid.v, ow: building.w, od: building.d };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (target.getAttribute("data-building") === "1") {
      dragRef.current = { kind: "move", su: uv.u, sv: uv.v, ou: grid.u, ov: grid.v };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const uv = pointerToUV(e);
    if (d.kind === "move") {
      apply({ u: d.ou + uv.u - d.su, v: d.ov + uv.v - d.sv });
    } else if (d.kind === "edge") {
      const du = uv.u - d.su, dv = uv.v - d.sv;
      if (d.edge === "right") apply({ w: d.ow + du });
      else if (d.edge === "top") apply({ d: d.od + dv });
      else if (d.edge === "left") { const nu = snapKeep(d.ou + du, d.ou); apply({ u: nu, w: d.ow + (d.ou - nu) }); }
      else { const nv = snapKeep(d.ov + dv, d.ov); apply({ v: nv, d: d.od + (d.ov - nv) }); }
    } else if (d.kind === "corner") {
      // 角のハンドル: 外側の角から内側へ引いた分だけ切り欠く。角まで戻すと切り欠きが消える
      const ox = d.corner === "SW" || d.corner === "NW" ? 0 : d.ow;
      const oy = d.corner === "SW" || d.corner === "SE" ? 0 : d.od;
      const inX = d.corner === "SW" || d.corner === "NW" ? 1 : -1;
      const inY = d.corner === "SW" || d.corner === "SE" ? 1 : -1;
      const nw = snap(Math.max(0, inX * (uv.u - d.ou - ox)));
      const nd = snap(Math.max(0, inY * (uv.v - d.ov - oy)));
      setProject((p) => {
        const others = (p.building.notches ?? []).filter((n) => n.corner !== d.corner);
        const keep = nw >= unit - 1e-6 && nd >= unit - 1e-6;
        const n: Notch = { corner: d.corner, w: Math.min(nw, p.building.w - unit), d: Math.min(nd, p.building.d - unit) };
        return { ...p, grid: { ...p.grid, paint: undefined }, building: { ...p.building, notches: keep ? [...others, n] : others } };
      });
    } else {
      const key = cellKeyAt(uv, d.ou, d.ov);
      if (key === d.last) return;
      d.last = key;
      const [ci, cj] = key.split(",").map(Number);
      if (d.add && !cellOk(ci, cj, d.ou, d.ov)) return; // 離れ線の外は足せない
      if (d.add) d.cells.add(key); else d.cells.delete(key);
      applyCells(d.cells, d.ou, d.ov);
    }
  };
  const onPointerUp = () => { dragRef.current = null; };

  // グリッド線の範囲
  const gu0 = Math.floor(minU / MODULE) * MODULE;
  const uLines: number[] = [];
  for (let u = gu0; u <= maxU; u += unit) uLines.push(round(u, 4));
  const vLines: number[] = [];
  for (let v = 0; v <= maxV; v += unit) vLines.push(round(v, 4));
  for (let v = -unit; v >= minV; v -= unit) vLines.push(round(v, 4));

  const edgeLen = (i: number) => { const a = site.points[i], b = site.points[(i + 1) % site.points.length]; return Math.hypot(b.x - a.x, b.y - a.y); };
  const edgeLabel = (i: number) => `P${i + 1}→P${((i + 1) % site.points.length) + 1}　${round(edgeLen(i), 2)}m${site.edges.find((e) => e.index === i)?.road ? "（道路）" : ""}${edgeLen(i) < 1 ? "（短い辺・非推奨）" : ""}`;
  const baseTooShort = edgeLen(grid.baseEdge) < 1;
  const mm = (m: number | null) => (m === null ? "－" : `${Math.round(m * 1000).toLocaleString()}`);

  const Stepper = ({ label, value, onChange, min = unit }: { label: string; value: number; onChange: (v: number) => void; min?: number }) => (
    <div className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost px-2 py-0.5" onClick={() => onChange(Math.max(min, value - unit))}>－</button>
        <span className="w-24 text-center text-sm font-medium">{value.toFixed(3)} m</span>
        <button className="btn-ghost px-2 py-0.5" onClick={() => onChange(value + unit)}>＋</button>
      </div>
    </div>
  );

  /** 寸法線（底辺座標の2点間） */
  const Dim = ({ a, b, label, side }: { a: Pt; b: Pt; label: string; side: "h" | "v" }) => {
    const pa = { x: X(a.x), y: Y(a.y) };
    const pb = { x: X(b.x), y: Y(b.y) };
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    return (
      <g>
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#c0392b" strokeWidth={1} markerStart="url(#dimS)" markerEnd="url(#dimE)" />
        <text x={side === "h" ? mx : mx + 6} y={side === "h" ? my - 5 : my + 4} textAnchor={side === "h" ? "middle" : "start"} fontSize={11} fontWeight={700} fill="#c0392b" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {label}
        </text>
      </g>
    );
  };

  const bu = grid.u, bv = grid.v, bw = building.w, bd = building.d;

  return (
    <div className={readOnly ? "block" : "grid gap-4 lg:grid-cols-[340px_1fr]"}>
      {!readOnly && (
      <aside className="space-y-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">1. 底辺にする辺</h3>
          <select className="field" value={grid.baseEdge} onChange={(e) => apply({ baseEdge: Number(e.target.value), u: HALF, v: HALF })}>
            {site.points.map((_, i) => (
              <option key={i} value={i}>{edgeLabel(i)}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flip} onChange={(e) => apply({ flip: e.target.checked })} />
            反転（180度回して、底辺を画面の上にする）
          </label>
          <div className="rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
            方位記号は「敷地図」画面の「方位」で決めた向き（現在 {northScreenDeg(project, "site")}度）を、この画面の回転・反転に合わせて回しています。直すときは敷地図で。
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">2. 建物の枠（{Math.round(unit * 1000 * 10) / 10}mm刻み）</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">最小単位</span>
            <select className="field w-auto px-1 py-0.5" value={unit} onChange={(e) => setProject((p) => ({ ...p, grid: { ...p.grid, unit: Number(e.target.value) } }))}>
              <option value={MODULE}>910mm（1マス）</option>
              <option value={HALF}>455mm（半マス）</option>
              <option value={0.2275}>227.5mm（1/4マス）</option>
            </select>
          </div>
          <div className="flex gap-1 text-xs">
            <button className={`flex-1 rounded px-2 py-1 ${mode === "move" ? "bg-brand-600 text-white" : "bg-slate-100"}`} onClick={() => setMode("move")}>動かす・伸ばす</button>
            <button className={`flex-1 rounded px-2 py-1 ${mode === "cells" ? "bg-brand-600 text-white" : "bg-slate-100"}`} onClick={() => setMode("cells")}>マスを足す・消す</button>
          </div>
          {mode === "cells" && (
            <div className="space-y-1 rounded bg-emerald-50 p-2 text-[11px] leading-relaxed text-emerald-900">
              {baseTooShort && (
                <div className="rounded bg-red-50 p-1 text-red-700">
                  今の底辺「{edgeLabel(grid.baseEdge)}」はごく短い辺なので、建物の向きがその辺に合ってしまい、隣の長い辺（隣地境界）と平行になりません。上の「底辺にする辺」で、平行にしたい長い辺（例: 南側や道路側の辺）を選び直してから「離れ線の角から始める」を押してください。
                </div>
              )}
              <div className="font-semibold">使い方：緑のマスをタップすると青（建築可能範囲）になります。もう一度タップで外れます。外周だけ塗って「囲った中を塗りつぶす」を押すと、中がまとめて青になります。</div>
              <div>
                マス目の原点は、底辺から {Math.round(setback * 1000)}mm・左の境界から {Math.round(setback * 1000)}mm の「離れ線の角」に自動で置いています。原点をずらしたいときは下のボタンで半マスずつ動かせます（塗ったマスは消えます）。
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                <button className="btn-ghost px-2 py-0.5" onClick={() => setProject((p) => ({ ...p, grid: { ...p.grid, paint: undefined } }))}>原点を離れ線の角に戻す</button>
                <button className="btn-ghost px-2 py-0.5" onClick={() => resetPaint(-HALF, 0)}>原点 ←半マス</button>
                <button className="btn-ghost px-2 py-0.5" onClick={() => resetPaint(HALF, 0)}>原点 半マス→</button>
                <button className="btn-ghost px-2 py-0.5" onClick={() => resetPaint(0, HALF)}>原点 ↑半マス</button>
                <button className="btn-ghost px-2 py-0.5" onClick={() => resetPaint(0, -HALF)}>原点 ↓半マス</button>
              </div>
              <div className="pt-1">境界までの一番近いところを {Math.round(setback * 1000)}mm ぴったりに揃える（塗ったマスごと原点を動かします）</div>
              <div className="grid grid-cols-4 gap-1">
                <button className="btn-ghost px-1 py-0.5" onClick={() => alignPaint("left")}>← 左</button>
                <button className="btn-ghost px-1 py-0.5" onClick={() => alignPaint("right")}>右 →</button>
                <button className="btn-ghost px-1 py-0.5" onClick={() => alignPaint("bottom")}>↓ 底辺側</button>
                <button className="btn-ghost px-1 py-0.5" onClick={() => alignPaint("top")}>↑ 奥</button>
              </div>
              {outCells.size > 0 && <div className="text-red-700">赤のマス {outCells.size} 個は離れ線の外に出ています。外すか、原点を動かしてください。</div>}
              <div className="flex flex-wrap gap-1 pt-1">
                <button className="btn-primary px-2 py-0.5" onClick={fillEnclosed}>囲った中を塗りつぶす</button>
                <button className="btn-ghost px-2 py-0.5" onClick={paintAll}>選べるマスを全部塗る</button>
                <button className="btn-ghost px-2 py-0.5" onClick={() => resetPaint(0, 0)}>全部消す</button>
              </div>
              <div className="text-emerald-800">塗ったマス {paint.cells.size}（{round(paint.cells.size * unit * unit, 2)}㎡）</div>
              {droppedCells.size > 0 && (
                <div className="text-orange-700">橙のマス {droppedCells.size} 個は、建物の形（四角＋角の切り欠き＝階段形）で表せないため建物には入っていません。穴や途中のへこみは作れないので、つなげて塗ってください。</div>
              )}
              {cellHint && <div className="text-red-700">{cellHint}</div>}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">{mode === "move" ? "図の建物をドラッグで移動、辺の□をドラッグで伸縮できます。" : "図のマスをクリック／ドラッグで、建物にマスを足したり消したりできます（角の切り欠きで表せる階段形に丸めます）。"}</p>
          <Stepper label="幅（底辺に沿って）" value={building.w} onChange={(v) => apply({ w: v })} />
          <Stepper label="奥行（底辺から内側へ）" value={building.d} onChange={(v) => apply({ d: v })} />
          <Stepper label="位置：底辺の始点から" value={grid.u} onChange={(v) => apply({ u: v })} min={-50} />
          <Stepper label="位置：底辺から内側へ" value={grid.v} onChange={(v) => apply({ v: v })} min={-50} />
          <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-600">
            <div className="mb-1">枠を離れ線（境界から {Math.round(setback * 1000)}mm）にぴったり寄せる</div>
            <div className="grid grid-cols-4 gap-1">
              <button className="btn-ghost px-1 py-0.5" onClick={() => pushTo("left")}>← 左</button>
              <button className="btn-ghost px-1 py-0.5" onClick={() => pushTo("right")}>右 →</button>
              <button className="btn-ghost px-1 py-0.5" onClick={() => pushTo("near")}>↓ 底辺側</button>
              <button className="btn-ghost px-1 py-0.5" onClick={() => pushTo("far")}>↑ 奥</button>
            </div>
            {cellHint && mode === "move" && <div className="mt-1 text-red-700">{cellHint}</div>}
          </div>
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-1 text-xs font-semibold text-slate-700">基点の角（ここを境界から {Math.round(setback * 1000)}mm ぴったりに置く）</div>
            <div className="grid grid-cols-2 gap-1">
              {(["NW", "NE", "SW", "SE"] as const).map((c) => (
                <button key={c} className={`rounded border px-2 py-1 text-xs ${anchor === c ? "border-brand-600 bg-brand-50 font-semibold" : "border-slate-300"}`} onClick={() => setProject((p) => ({ ...p, grid: { ...p.grid, anchor: c } }))}>{anchorName(c)}</button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={stepFull} onChange={(e) => setProject((p) => ({ ...p, grid: { ...p.grid, stepFull: e.target.checked } }))} />階段の刻みを 910mm（1マス）にする（455mm の細い壁が残らない）</label>
            <button className="btn-primary mt-2 w-full justify-center" onClick={snugFromAnchor}>基点を {Math.round(setback * 1000)}mm に合わせて離れ線いっぱいまで広げる（行数はそのまま）</button>
            <div className="mt-1 text-[11px] text-slate-500">基点の角は境界から {Math.round(setback * 1000)}mm ぴったり、ほかの辺は {Math.round(setback * 1000)}mm 以上を必ず確保して、境界なりの階段に広げます。奥行の行数は今の建物のままで、基点の角に寄せて置き直します。</div>
          </div>
          <button className="btn-primary w-full justify-center" onClick={autoStair}>離れ線の内側で最大の範囲にする（底辺に揃えて階段状）</button>
          <button className="btn-ghost w-full justify-center" onClick={() => { setNotches([]); autoMax(); }}>矩形で最大にする（切り欠きなし）</button>
          <p className="text-[11px] leading-relaxed text-slate-500">「最大の範囲」は、底辺（選んだ辺）から離れ {Math.round(setback * 1000)}mm の線に建物の底辺をぴったり揃え、残りの辺は敷地なりに455mm刻みで削った形です。限界まで建てたときの建築面積の目安になります。離れの数値は敷地図の「離れ」で変えられます（壁の芯までの距離として扱います）。</p>
          <div className="space-y-1 rounded border border-slate-200 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">角の切り欠き（L字・コの字にする）</span>
              <select className="field w-auto px-1 py-0.5 text-xs" value="" onChange={(e) => { const c = e.target.value as Notch["corner"]; if (!c) return; setNotches([...(building.notches ?? []), { corner: c, w: MODULE, d: MODULE }]); }}>
                <option value="">＋角を選ぶ（同じ角に複数で階段状）</option>
                {(["SW", "SE", "NE", "NW"] as const).map((c) => <option key={c} value={c}>{CORNER_LABEL[c]}</option>)}
              </select>
            </div>
            {(building.notches ?? []).map((n, i) => (
              <div key={i} className="rounded bg-slate-50 p-1 text-xs">
                <div className="flex items-center justify-between"><b>{CORNER_LABEL[n.corner]}</b><button className="btn-ghost px-2 py-0 text-red-500" onClick={() => setNotches((building.notches ?? []).filter((_, j) => j !== i))}>✕</button></div>
                <Stepper label="幅方向" value={n.w} onChange={(v) => setNotches((building.notches ?? []).map((x, j) => (j === i ? { ...x, w: Math.min(Math.max(unit, snap(v)), building.w - unit) } : x)))} />
                <Stepper label="奥行方向" value={n.d} onChange={(v) => setNotches((building.notches ?? []).map((x, j) => (j === i ? { ...x, d: Math.min(Math.max(unit, snap(v)), building.d - unit) } : x)))} />
              </div>
            ))}
            {!(building.notches ?? []).length && <p className="text-[11px] text-slate-500">矩形以外の建物は、外接する枠を決めてから角を切り欠きます。建築面積・斜線・天空率・日影は切り欠き後の形で計算します。</p>}
          </div>
          <div className="rounded bg-slate-50 p-2 text-xs leading-relaxed">
            <div>枠: <b>{modules(building.w)}マス × {modules(building.d)}マス</b>（1マス=910mm）</div>
            <div>建築面積 <b>{round(bArea, 2)} m²</b>（{round(bArea / TSUBO_M2, 2)}坪）</div>
            <div>建ぺい率 <b className={coverage > site.coverageRatio ? "text-red-600" : ""}>{round(coverage, 1)}%</b>（上限 {site.coverageRatio}% → {round((area * site.coverageRatio) / 100, 2)} m² まで）</div>
            <div>離れ {Math.round(setback * 1000)} mm: {fits ? <span className="text-emerald-700">✓ 内側に収まっています</span> : <span className="text-red-600">⚠ 離れ線からはみ出しています</span>}</div>
            <div className="mt-1 border-t border-slate-200 pt-1">境界までの距離（mm）: 底辺側 <b>{mm(cl.bottom)}</b> ／ 奥 <b>{mm(cl.top)}</b> ／ 左 <b>{mm(cl.left)}</b> ／ 右 <b>{mm(cl.right)}</b></div>
          </div>
          <p className="text-[11px] text-slate-500">この枠が、そのまま間取り図の外形になります。境界までの距離は1階の間取り図にも出ます。</p>
        </div>
      </aside>
      )}

      <section className="space-y-2">
        <div className={`flex flex-wrap items-center justify-between gap-2 ${readOnly ? "print-hide" : ""}`}>
          <div className="text-sm text-slate-600"><b>{project.name}</b> 建築可能範囲（910mmグリッド）</div>
          <button className="btn-ghost" onClick={() => svgRef.current && downloadSvgAsPng(svgRef.current, `${project.name}_建築可能範囲.png`)}>PNG保存</button>
        </div>
        <div className="card overflow-auto p-2">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={`mx-auto max-h-[78vh] w-full select-none ${!readOnly && mode === "cells" ? "cursor-crosshair" : ""}`} style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif", touchAction: readOnly ? undefined : "none" }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <defs>
              <marker id="dimE" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c0392b" /></marker>
              <marker id="dimS" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto"><path d="M8,0 L0,4 L8,8 z" fill="#c0392b" /></marker>
            </defs>
            <rect width={W} height={H} fill="#fff" />
            {/* 道路帯 */}
            {roads.map((r, i) => (
              <g key={"road" + i}>
                <polygon points={r.poly.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="#e9ecf1" stroke="#c9ced8" strokeWidth={1} />
                <text x={X(r.mid.x)} y={Y(r.mid.y) - 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="#333">約{r.w.toFixed(1)}m</text>
                <text x={X(r.mid.x)} y={Y(r.mid.y) + 12} textAnchor="middle" fontSize={11} fill="#444">{r.label}</text>
              </g>
            ))}
            {/* グリッド（455は点線、910は実線） */}
            {uLines.map((u) => {
              const full = Math.abs(((u - gu0) / MODULE) % 1) < 1e-6;
              return <line key={"u" + u} x1={X(u)} y1={Y(minV)} x2={X(u)} y2={Y(maxV)} stroke={full ? "#c9d3e0" : "#e6ebf2"} strokeWidth={full ? 1 : 0.7} strokeDasharray={full ? undefined : "2 3"} />;
            })}
            {vLines.map((v) => {
              const full = Math.abs((v / MODULE) % 1) < 1e-6;
              return <line key={"v" + v} x1={X(minU)} y1={Y(v)} x2={X(maxU)} y2={Y(v)} stroke={full ? "#c9d3e0" : "#e6ebf2"} strokeWidth={full ? 1 : 0.7} strokeDasharray={full ? undefined : "2 3"} />;
            })}
            {/* 道路後退（セットバック）部分: 後退前の境界線＋斜線 */}
            {sbEdges.length > 0 && (
              <g>
                <defs>
                  <pattern id="gridSetbackHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="7" stroke="#b03a2e" strokeWidth="1.1" />
                  </pattern>
                </defs>
                <path d={`M${origLoc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" L")} Z M${loc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" L")} Z`} fill="url(#gridSetbackHatch)" fillRule="evenodd" opacity={0.65} />
                <polygon points={origLoc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke="#1b2430" strokeWidth={1} strokeDasharray="4 3" />
              </g>
            )}
            {/* 敷地（後退後の有効敷地） */}
            <polygon points={loc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="rgba(246,234,211,0.55)" stroke="#1b2430" strokeWidth={2.5} strokeLinejoin="round" />
            {sbEdges.map((e, i) => {
              const a = toLocal(frame, e.a), b = toLocal(frame, e.b), n = rotN(e.n);
              const mx = a.x + (b.x - a.x) * 0.25, my = a.y + (b.y - a.y) * 0.25;
              const p0 = { x: X(mx), y: Y(my) }, p1 = { x: X(mx + n.x * e.setback), y: Y(my + n.y * e.setback) };
              const pt = { x: X(mx + n.x * (e.setback + 0.25)), y: Y(my + n.y * (e.setback + 0.25)) };
              const horiz = Math.abs(p1.x - p0.x) >= Math.abs(p1.y - p0.y);
              const anchor = horiz ? (p1.x >= p0.x ? "start" : "end") : "middle";
              const ty = horiz ? pt.y + 4 : p1.y >= p0.y ? pt.y + 12 : pt.y - 14;
              return (
                <g key={"sb" + i}>
                  <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#b03a2e" strokeWidth={1.5} markerStart="url(#dimS)" markerEnd="url(#dimE)" />
                  <text x={pt.x} y={ty} textAnchor={anchor} fontSize={12} fontWeight={700} fill="#b03a2e">道路後退 {round(e.setback, 2)}m</text>
                  <text x={pt.x} y={ty + 13} textAnchor={anchor} fontSize={10} fill="#b03a2e">斜線＝後退部分 約{round(stripArea, 2)}㎡（幅員{round(e.width, 2)}m→{round(e.width + 2 * e.setback, 2)}m）</text>
                </g>
              );
            })}
            {/* 底辺を強調 */}
            <line x1={X(0)} y1={Y(0)} x2={X(frame.len)} y2={Y(0)} stroke="#1b2430" strokeWidth={5} />
            <text x={X(frame.len / 2)} y={Y(0) + (flip ? -8 : 18)} textAnchor="middle" fontSize={12} fill="#1b2430">底辺 {edgeLabel(grid.baseEdge)}　{round(frame.len, 2)} m</text>
            {/* 離れ線 */}
            {setback > 0 && <polygon points={innerLoc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke="#c0392b" strokeWidth={1.2} strokeDasharray="6 4" />}
            {/* 建物の枠 */}
            {notches.length > 0 && <rect x={Math.min(X(bu), X(bu + bw))} y={Math.min(Y(bv), Y(bv + bd))} width={bw * PX} height={bd * PX} fill="none" stroke={fits ? "#2f6fed" : "#c0392b"} strokeWidth={1} strokeDasharray="4 3" />}
            <polygon data-building="1" points={footprintPolygon(building).map((q) => `${X(bu + q.x)},${Y(bv + q.y)}`).join(" ")} fill={fits ? "rgba(47,111,237,0.18)" : "rgba(220,60,60,0.2)"} stroke={fits ? "#2f6fed" : "#c0392b"} strokeWidth={2.5} strokeLinejoin="round" style={{ cursor: readOnly ? undefined : mode === "cells" ? "crosshair" : "move" }} />
            {/* マス編集モード: 枠の周り1マスまで薄く表示（クリックで追加） */}
            {!readOnly && mode === "cells" && (() => {
              // 塗りマスの原点（離れ線の角）を基準に、離れ線の内側に入るマスを緑（選べる）、塗ったマスを青、丸めで落ちたマスを橙で示す
              const us = loc.map((p) => p.x), vs = loc.map((p) => p.y);
              const pu = paint.u, pv = paint.v;
              const i0 = Math.floor((Math.min(...us) - pu) / unit) - 1, i1 = Math.ceil((Math.max(...us) - pu) / unit) + 1;
              const j0 = Math.floor((Math.min(...vs) - pv) / unit) - 1, j1 = Math.ceil((Math.max(...vs) - pv) / unit) + 1;
              const out: React.ReactNode[] = [];
              for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
                const key = `${i},${j}`;
                const painted = paint.cells.has(key);
                const ok = cellOk(i, j, pu, pv);
                if (!painted && !ok) continue;
                const dropped = painted && droppedCells.has(key);
                const outside = painted && outCells.has(key);
                const u = pu + i * unit, v = pv + j * unit;
                out.push(<rect key={`c${i}_${j}`} x={Math.min(X(u), X(u + unit))} y={Math.min(Y(v), Y(v + unit))} width={unit * PX} height={unit * PX} fill={outside ? "rgba(220,60,60,0.5)" : dropped ? "rgba(240,140,30,0.45)" : painted ? "rgba(47,111,237,0.45)" : "rgba(46,160,67,0.16)"} stroke={painted ? "#fff" : "rgba(46,160,67,0.45)"} strokeWidth={painted ? 1 : 0.6} style={{ pointerEvents: "none" }} />);
              }
              // 原点の印
              const o = { x: X(pu), y: Y(pv) };
              out.push(<circle key="origin" cx={o.x} cy={o.y} r={5} fill="#fff" stroke="#c0392b" strokeWidth={2} style={{ pointerEvents: "none" }} />);
              out.push(<text key="originT" x={o.x + 8} y={o.y + 14} fontSize={10} fill="#c0392b" style={{ pointerEvents: "none" }}>原点（離れ{Math.round(setback * 1000)}mmの角）</text>);
              return out;
            })()}
            {/* 辺のハンドル（ドラッグで伸縮） */}
            {!readOnly && mode === "move" && ([["left", bu, bv + bd / 2], ["right", bu + bw, bv + bd / 2], ["bottom", bu + bw / 2, bv], ["top", bu + bw / 2, bv + bd]] as const).map(([h, hu, hv]) => (
              <rect key={h} data-handle={h} x={X(hu) - 7} y={Y(hv) - 7} width={14} height={14} rx={3} fill="#fff" stroke="#2f6fed" strokeWidth={2} style={{ cursor: h === "left" || h === "right" ? "ew-resize" : "ns-resize" }} />
            ))}
            {/* 角のハンドル: 内側へドラッグすると切り欠き、角まで戻すと消える */}
            {!readOnly && mode === "move" && (["SW", "SE", "NE", "NW"] as const).map((c) => {
              const n = notches.find((x) => x.corner === c);
              const ox = c === "SW" || c === "NW" ? 0 : bw;
              const oy = c === "SW" || c === "SE" ? 0 : bd;
              const hx = ox + (n ? (c === "SW" || c === "NW" ? n.w : -n.w) : 0);
              const hy = oy + (n ? (c === "SW" || c === "SE" ? n.d : -n.d) : 0);
              return <circle key={c} data-corner={c} cx={X(bu + hx)} cy={Y(bv + hy)} r={7} fill={n ? "#2f6fed" : "#fff"} stroke="#2f6fed" strokeWidth={2} style={{ cursor: "crosshair" }}><title>{n ? "ドラッグで切り欠きの大きさを変える（角まで戻すと消える）" : "内側へドラッグすると角を切り欠く"}</title></circle>;
            })}
            <text x={X(bu + bw / 2)} y={Y(bv + bd / 2)} textAnchor="middle" fontSize={14} fontWeight={700} fill={fits ? "#1d479c" : "#c0392b"} style={{ pointerEvents: "none" }}>
              {modules(building.w)}×{modules(building.d)}マス
            </text>
            <text x={X(bu + bw / 2)} y={Y(bv + bd / 2) + 18} textAnchor="middle" fontSize={11} fill="#1d479c" style={{ pointerEvents: "none" }}>
              {building.w.toFixed(2)}m × {building.d.toFixed(2)}m{notches.length ? "（切り欠き後）" : " ＝"} {round(bArea, 2)}m²
            </text>
            {/* 境界までの寸法 */}
            {clm.bottom && <Dim a={clm.bottom.at} b={clm.bottom.to} label={mm(clm.bottom.d)} side="v" />}
            {clm.top && <Dim a={clm.top.at} b={clm.top.to} label={mm(clm.top.d)} side="v" />}
            {clm.left && <Dim a={clm.left.at} b={clm.left.to} label={mm(clm.left.d)} side="h" />}
            {clm.right && <Dim a={clm.right.at} b={clm.right.to} label={mm(clm.right.d)} side="h" />}
            {/* 境界点番号 */}
            {loc.map((p, i) => (
              <g key={i}>
                <circle cx={X(p.x)} cy={Y(p.y)} r={4} fill="#fff" stroke="#1b2430" strokeWidth={1.5} />
                <text x={X(p.x) + 6} y={Y(p.y) - 6} fontSize={10} fill="#555">P{i + 1}</text>
              </g>
            ))}
            {/* 方位 */}
            <g transform={`translate(${W - 50} 50)`}>
              <circle r={20} fill="#fff" stroke="#333" strokeWidth={1} />
              <g transform={`rotate(${northLocalDeg})`}>
                <polygon points="0,-16 6,6 0,2 -6,6" fill="#111" />
              </g>
              <text x={Math.sin((northLocalDeg * Math.PI) / 180) * 30} y={-Math.cos((northLocalDeg * Math.PI) / 180) * 30 + 4} textAnchor="middle" fontSize={12} fontWeight={700}>N</text>
            </g>
          </svg>
        </div>
        <p className="text-[11px] text-slate-500">実線が910mm、点線が455mm。赤い破線は境界からの離れ（{Math.round(setback * 1000)}mm）。赤い寸法は建物の各辺から境界線までの距離（mm）。</p>
      </section>
    </div>
  );
}
