"use client";

import { useMemo, useRef } from "react";
import type { Project, Pt } from "@/lib/types";
import { HALF, MODULE, TSUBO_M2 } from "@/lib/types";
import { insetPolygon, round, polygonArea } from "@/lib/geometry";
import { baseFrame, toLocal, buildingFromGrid, snapHalf, maxRect, rectFits, modules } from "@/lib/grid";
import { downloadSvgAsPng } from "@/lib/store";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

const PX = 44;

export default function BuildableGrid({ project, setProject }: Props) {
  const { site, grid, building } = project;
  const svgRef = useRef<SVGSVGElement>(null);

  const frame = useMemo(() => baseFrame(site, grid.baseEdge), [site, grid.baseEdge]);
  const setback = site.fireproofException ? 0 : site.setback;
  const inner = useMemo(() => (setback > 0 ? insetPolygon(site.points, setback) : site.points), [site.points, setback]);
  const loc = site.points.map((p) => toLocal(frame, p));
  const innerLoc = inner.map((p) => toLocal(frame, p));

  const minU = Math.min(...loc.map((p) => p.x)) - 1.5;
  const maxU = Math.max(...loc.map((p) => p.x)) + 1.5;
  const minV = -1.5;
  const maxV = Math.max(...loc.map((p) => p.y)) + 1.5;
  const W = (maxU - minU) * PX;
  const H = (maxV - minV) * PX;
  const X = (u: number) => (u - minU) * PX;
  const Y = (v: number) => (maxV - v) * PX;

  const fits = rectFits(frame, inner, grid.u, grid.v, building.w, building.d);
  const area = site.areaOverride ?? polygonArea(site.points);
  const bArea = building.w * building.d;
  const coverage = (bArea / area) * 100;

  // 北の向き（底辺座標での角度、上から時計回り）
  const nd = (site.northDeg * Math.PI) / 180;
  const northWorld = { x: Math.sin(nd), y: Math.cos(nd) };
  const nLocal = { x: northWorld.x * frame.t.x + northWorld.y * frame.t.y, y: northWorld.x * frame.n.x + northWorld.y * frame.n.y };
  const northLocalDeg = (Math.atan2(nLocal.x, nLocal.y) * 180) / Math.PI;

  const apply = (patch: { u?: number; v?: number; w?: number; d?: number; baseEdge?: number }) =>
    setProject((p) => {
      const g = { ...p.grid, ...(patch.baseEdge !== undefined ? { baseEdge: patch.baseEdge } : {}), ...(patch.u !== undefined ? { u: snapHalf(patch.u) } : {}), ...(patch.v !== undefined ? { v: snapHalf(patch.v) } : {}) };
      const w = patch.w !== undefined ? Math.max(HALF, snapHalf(patch.w)) : p.building.w;
      const d = patch.d !== undefined ? Math.max(HALF, snapHalf(patch.d)) : p.building.d;
      return { ...p, grid: g, building: buildingFromGrid(p.site, g, w, d, p.building) };
    });

  const autoMax = () => {
    const best = maxRect(site, grid.baseEdge, setback);
    if (best.area === 0) {
      alert("離れ線の内側に455mm角が1つも入りません。離れの設定か境界点を確認してください。");
      return;
    }
    apply({ u: best.u, v: best.v, w: best.w, d: best.d });
  };

  // グリッド線の範囲
  const gu0 = Math.floor(minU / MODULE) * MODULE;
  const gv0 = 0;
  const uLines: number[] = [];
  for (let u = gu0; u <= maxU; u += HALF) uLines.push(round(u, 3));
  const vLines: number[] = [];
  for (let v = gv0; v <= maxV; v += HALF) vLines.push(round(v, 3));
  for (let v = -HALF; v >= minV; v -= HALF) vLines.push(round(v, 3));

  const edgeLabel = (i: number) => `P${i + 1}→P${((i + 1) % site.points.length) + 1}${site.edges.find((e) => e.index === i)?.road ? "（道路）" : ""}`;

  const Stepper = ({ label, value, onChange, min = HALF }: { label: string; value: number; onChange: (v: number) => void; min?: number }) => (
    <div className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost px-2 py-0.5" onClick={() => onChange(Math.max(min, value - HALF))}>－</button>
        <span className="w-24 text-center text-sm font-medium">{value.toFixed(3)} m</span>
        <button className="btn-ghost px-2 py-0.5" onClick={() => onChange(value + HALF)}>＋</button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">1. 底辺にする辺と北の向き</h3>
          <div>
            <span className="label">底辺（この辺を水平にしてグリッドを引く）</span>
            <select className="field" value={grid.baseEdge} onChange={(e) => apply({ baseEdge: Number(e.target.value), u: HALF, v: HALF })}>
              {site.points.map((_, i) => (
                <option key={i} value={i}>{edgeLabel(i)}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">北の向き（画面上を0として時計回りの度数。敷地図と共通）</span>
            <div className="flex items-center gap-1">
              <input type="number" step="1" className="field" value={site.northDeg} onChange={(e) => setProject((p) => ({ ...p, site: { ...p.site, northDeg: Number(e.target.value) } }))} />
              {[0, 90, 180, 270].map((d) => (
                <button key={d} className="btn-ghost px-2" onClick={() => setProject((p) => ({ ...p, site: { ...p.site, northDeg: d } }))}>{d}°</button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">測量図の北矢印を見て、ここで手動で合わせてください。AIの読み取りは目安です。</p>
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">2. 建物の枠（455mm刻み）</h3>
          <Stepper label="幅（底辺に沿って）" value={building.w} onChange={(v) => apply({ w: v })} />
          <Stepper label="奥行（底辺から内側へ）" value={building.d} onChange={(v) => apply({ d: v })} />
          <Stepper label="位置：底辺の始点から" value={grid.u} onChange={(v) => apply({ u: v })} min={-50} />
          <Stepper label="位置：底辺から内側へ" value={grid.v} onChange={(v) => apply({ v: v })} min={-50} />
          <button className="btn-primary w-full justify-center" onClick={autoMax}>離れ線の内側で最大の枠にする</button>
          <div className="rounded bg-slate-50 p-2 text-xs leading-relaxed">
            <div>枠: <b>{modules(building.w)}マス × {modules(building.d)}マス</b>（1マス=910mm）</div>
            <div>建築面積 <b>{round(bArea, 2)} m²</b>（{round(bArea / TSUBO_M2, 2)}坪）</div>
            <div>建ぺい率 <b className={coverage > site.coverageRatio ? "text-red-600" : ""}>{round(coverage, 1)}%</b>（上限 {site.coverageRatio}% → {round((area * site.coverageRatio) / 100, 2)} m² まで）</div>
            <div>離れ {setback} m: {fits ? <span className="text-emerald-700">✓ 内側に収まっています</span> : <span className="text-red-600">⚠ 離れ線からはみ出しています</span>}</div>
          </div>
          <p className="text-[11px] text-slate-500">この枠が、そのまま間取り図の外形になります。</p>
        </div>
      </aside>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600"><b>{project.name}</b> 建築可能範囲（910mmグリッド）</div>
          <button className="btn-ghost" onClick={() => svgRef.current && downloadSvgAsPng(svgRef.current, `${project.name}_建築可能範囲.png`)}>PNG保存</button>
        </div>
        <div className="card overflow-auto p-2">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="mx-auto max-h-[78vh] w-full select-none" style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}>
            <rect width={W} height={H} fill="#fff" />
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
            <text x={X(frame.len / 2)} y={Y(0) + 18} textAnchor="middle" fontSize={12} fill="#1b2430">底辺 {edgeLabel(grid.baseEdge)}　{round(frame.len, 2)} m</text>
            {/* 離れ線 */}
            {setback > 0 && <polygon points={innerLoc.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke="#c0392b" strokeWidth={1.2} strokeDasharray="6 4" />}
            {/* 建物の枠 */}
            <rect x={X(grid.u)} y={Y(grid.v + building.d)} width={building.w * PX} height={building.d * PX} fill={fits ? "rgba(47,111,237,0.18)" : "rgba(220,60,60,0.2)"} stroke={fits ? "#2f6fed" : "#c0392b"} strokeWidth={2.5} />
            <text x={X(grid.u + building.w / 2)} y={Y(grid.v + building.d / 2)} textAnchor="middle" fontSize={14} fontWeight={700} fill={fits ? "#1d479c" : "#c0392b"}>
              {modules(building.w)}×{modules(building.d)}マス
            </text>
            <text x={X(grid.u + building.w / 2)} y={Y(grid.v + building.d / 2) + 18} textAnchor="middle" fontSize={11} fill="#1d479c">
              {building.w.toFixed(2)}m × {building.d.toFixed(2)}m ＝ {round(bArea, 2)}m²
            </text>
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
        <p className="text-[11px] text-slate-500">実線が910mm、点線が455mm。赤い破線は境界からの離れ（民法234条）。建物の枠は455mm単位で動かせます。</p>
      </section>
    </div>
  );
}

export type { Pt };
