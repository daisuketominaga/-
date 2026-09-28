"use client";

import { useMemo, useRef, useState } from "react";
import type { Notch, Project, Pt } from "@/lib/types";
import { HALF, MODULE, TSUBO_M2 } from "@/lib/types";
import { insetPolygon, round, polygonArea, northScreenDeg, footprintArea, notchesOf, footprintPolygon } from "@/lib/geometry";
import { baseFrame, toLocal, buildingFromGrid, maxRect, footprintFits, maxStair, modules, clearances, roadBands, cellsToShape, shapeToCells } from "@/lib/grid";
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
  const { site, grid, building } = project;
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

  // 道路帯（底辺座標）
  const roadW = Math.max(0, ...site.edges.filter((e) => e.road).map((e) => e.roadWidth ?? 4));
  const roads = roadBands(site, frame, 6);

  const allU = [...loc.map((p) => p.x), ...roads.flatMap((r) => r.poly.map((p) => p.x))];
  const allV = [...loc.map((p) => p.y), ...roads.flatMap((r) => r.poly.map((p) => p.y))];
  const minU = Math.min(...loc.map((p) => p.x)) - 1.5;
  const maxU = Math.max(...loc.map((p) => p.x)) + 1.5;
  const minV = Math.min(-1.5, Math.min(...allV) - 0.3, -roadW - 0.6);
  const maxV = Math.max(...loc.map((p) => p.y)) + 1.5;
  void allU;
  const W = (maxU - minU) * PX;
  const H = (maxV - minV) * PX;
  // 反転時は180度回転（底辺が上）
  const X = (u: number) => (flip ? (maxU - u) * PX : (u - minU) * PX);
  const Y = (v: number) => (flip ? (v - minV) * PX : (maxV - v) * PX);

  const fits = footprintFits(frame, inner, grid, building);
  const area = site.areaOverride ?? polygonArea(site.points);
  const bArea = footprintArea(building);
  const notches = notchesOf(building);
  const coverage = (bArea / area) * 100;
  const cl = clearances(site, grid, building.w, building.d);

  // 北の向き（画面上、上から時計回り）。敷地図で決めた1つの値から計算
  const northLocalDeg = northScreenDeg(project, "plan");

  const apply = (patch: { u?: number; v?: number; w?: number; d?: number; baseEdge?: number; flip?: boolean }) =>
    setProject((p) => {
      const g = {
        ...p.grid,
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
  const autoStair = () => {
    const r = maxStair(site, grid.baseEdge, setback, ((grid.u % unit) + unit) % unit, unit);
    if (r.cells === 0) {
      alert(`離れ線の内側に${Math.round(unit * 1000)}mm角が1つも入りません。離れの設定か境界点を確認してください。`);
      return;
    }
    setProject((p) => {
      const g = { ...p.grid, u: r.u, v: r.v };
      return { ...p, grid: g, building: { ...buildingFromGrid(p.site, g, r.w, r.d, p.building), notches: r.notches } };
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
  const applyCells = (cells: Set<string>, ou: number, ov: number) => {
    const r = cellsToShape(cells, unit);
    if (!r.cells) return;
    setProject((p) => {
      const g = { ...p.grid, u: round(ou + r.u, 4), v: round(ov + r.v, 4) };
      return { ...p, grid: g, building: { ...buildingFromGrid(p.site, g, r.w, r.d, p.building), notches: r.notches } };
    });
  };
  const cellKeyAt = (uv: { u: number; v: number }, ou: number, ov: number) => `${Math.floor((uv.u - ou) / unit)},${Math.floor((uv.v - ov) / unit)}`;
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const uv = pointerToUV(e);
    const target = e.target as SVGElement;
    const handle = target.getAttribute("data-handle") as "left" | "right" | "top" | "bottom" | null;
    if (mode === "cells") {
      const cells = shapeToCells(building, unit);
      const key = cellKeyAt(uv, grid.u, grid.v);
      const add = !cells.has(key);
      if (add) cells.add(key); else cells.delete(key);
      dragRef.current = { kind: "cells", add, cells, ou: grid.u, ov: grid.v, last: key };
      applyCells(cells, grid.u, grid.v);
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
        return { ...p, building: { ...p.building, notches: keep ? [...others, n] : others } };
      });
    } else {
      const key = cellKeyAt(uv, d.ou, d.ov);
      if (key === d.last) return;
      d.last = key;
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

  const edgeLabel = (i: number) => `P${i + 1}→P${((i + 1) % site.points.length) + 1}${site.edges.find((e) => e.index === i)?.road ? "（道路）" : ""}`;
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
          <p className="text-[11px] leading-relaxed text-slate-500">{mode === "move" ? "図の建物をドラッグで移動、辺の□をドラッグで伸縮できます。" : "図のマスをクリック／ドラッグで、建物にマスを足したり消したりできます（角の切り欠きで表せる階段形に丸めます）。"}</p>
          <Stepper label="幅（底辺に沿って）" value={building.w} onChange={(v) => apply({ w: v })} />
          <Stepper label="奥行（底辺から内側へ）" value={building.d} onChange={(v) => apply({ d: v })} />
          <Stepper label="位置：底辺の始点から" value={grid.u} onChange={(v) => apply({ u: v })} min={-50} />
          <Stepper label="位置：底辺から内側へ" value={grid.v} onChange={(v) => apply({ v: v })} min={-50} />
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
            {/* 敷地 */}
            <polygon points={loc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="rgba(246,234,211,0.55)" stroke="#1b2430" strokeWidth={2.5} strokeLinejoin="round" />
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
              const cells = shapeToCells(building, unit);
              const ni = Math.round(building.w / unit), nj = Math.round(building.d / unit);
              const out: React.ReactNode[] = [];
              for (let i = -1; i <= ni; i++) for (let j = -1; j <= nj; j++) {
                const inside = cells.has(`${i},${j}`);
                const u = bu + i * unit, v = bv + j * unit;
                out.push(<rect key={`c${i}_${j}`} x={Math.min(X(u), X(u + unit))} y={Math.min(Y(v), Y(v + unit))} width={unit * PX} height={unit * PX} fill={inside ? "rgba(47,111,237,0.08)" : "rgba(47,111,237,0.03)"} stroke="rgba(47,111,237,0.35)" strokeWidth={0.6} style={{ pointerEvents: "none" }} />);
              }
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
            {cl.bottom !== null && <Dim a={{ x: bu + bw * 0.25, y: bv }} b={{ x: bu + bw * 0.25, y: bv - cl.bottom }} label={mm(cl.bottom)} side="v" />}
            {cl.top !== null && <Dim a={{ x: bu + bw * 0.75, y: bv + bd }} b={{ x: bu + bw * 0.75, y: bv + bd + cl.top }} label={mm(cl.top)} side="v" />}
            {cl.left !== null && <Dim a={{ x: bu, y: bv + bd * 0.75 }} b={{ x: bu - cl.left, y: bv + bd * 0.75 }} label={mm(cl.left)} side="h" />}
            {cl.right !== null && <Dim a={{ x: bu + bw, y: bv + bd * 0.25 }} b={{ x: bu + bw + cl.right, y: bv + bd * 0.25 }} label={mm(cl.right)} side="h" />}
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
