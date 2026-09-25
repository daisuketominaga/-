"use client";

import { useMemo, useRef, useState } from "react";
import type { Project, Pt, Site, SiteEdge } from "@/lib/types";
import { TSUBO_M2 } from "@/lib/types";
import { polygonArea, centroid, bbox, insetPolygon, dist, round } from "@/lib/geometry";
import { downloadSvgAsPng } from "@/lib/store";
import SurveyImport from "./SurveyImport";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

const PX_PER_M = 40;

export default function SitePlan({ project, setProject }: Props) {
  const { site } = project;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ kind: "pt"; i: number } | null>(null);
  const [showSetback, setShowSetback] = useState(true);

  const setSite = (u: (s: Site) => Site) => setProject((p) => ({ ...p, site: u(p.site) }));

  // ===== 計算 =====
  const areaCalc = polygonArea(site.points);
  const area = site.areaOverride ?? areaCalc;
  const setbackPoly = useMemo(() => insetPolygon(site.points, site.setback), [site.points, site.setback]);

  // ===== 描画範囲（道路帯を含めて余白をとる）=====
  const view = useMemo(() => {
    const pts = [...site.points];
    const roadW = Math.max(0, ...site.edges.filter((e) => e.road).map((e) => e.roadWidth ?? 4));
    const b = bbox(pts);
    const pad = 2.2 + roadW;
    return {
      minX: b.minX - pad,
      maxX: b.maxX + pad,
      minY: b.minY - pad,
      maxY: b.maxY + pad,
    };
  }, [site]);
  const W = (view.maxX - view.minX) * PX_PER_M;
  const H = (view.maxY - view.minY) * PX_PER_M;
  const toPx = (p: Pt) => ({ x: (p.x - view.minX) * PX_PER_M, y: (view.maxY - p.y) * PX_PER_M });
  const fromPx = (x: number, y: number): Pt => ({ x: x / PX_PER_M + view.minX, y: view.maxY - y / PX_PER_M });

  const clientToLocal = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM()!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    // 北回転を打ち消す
    const c = { x: W / 2, y: H / 2 };
    const r = (site.northDeg * Math.PI) / 180;
    const dx = pt.x - c.x;
    const dy = pt.y - c.y;
    const x = c.x + dx * Math.cos(r) - dy * Math.sin(r);
    const y = c.y + dx * Math.sin(r) + dy * Math.cos(r);
    return fromPx(x, y);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = clientToLocal(e);
    setSite((s) => ({
      ...s,
      points: s.points.map((q, i) => (i === drag.i ? { x: round(p.x, 2), y: round(p.y, 2) } : q)),
    }));
  };

  const polyPx = site.points.map(toPx);
  const cen = toPx(centroid(site.points));

  // 辺の外側方向（寸法線・道路帯用）
  const ccw = (() => {
    let s = 0;
    for (let i = 0; i < site.points.length; i++) {
      const a = site.points[i];
      const b = site.points[(i + 1) % site.points.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s > 0;
  })();
  const outwardNormal = (i: number) => {
    const a = site.points[i];
    const b = site.points[(i + 1) % site.points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return ccw ? { x: dy / len, y: -dx / len } : { x: -dy / len, y: dx / len };
  };

  const edgeOf = (i: number): SiteEdge => site.edges.find((e) => e.index === i) ?? { index: i };
  const setEdge = (i: number, patch: Partial<SiteEdge>) =>
    setSite((s) => {
      const exists = s.edges.some((e) => e.index === i);
      const edges = exists
        ? s.edges.map((e) => (e.index === i ? { ...e, ...patch } : e))
        : [...s.edges, { index: i, ...patch }];
      return { ...s, edges };
    });

  const addPoint = (i: number) => {
    const a = site.points[i];
    const b = site.points[(i + 1) % site.points.length];
    const mid = { x: round((a.x + b.x) / 2, 2), y: round((a.y + b.y) / 2, 2) };
    setSite((s) => {
      const points = [...s.points];
      points.splice(i + 1, 0, mid);
      const edges = s.edges.map((e) => (e.index > i ? { ...e, index: e.index + 1 } : e));
      return { ...s, points, edges };
    });
  };
  const removePoint = (i: number) => {
    if (site.points.length <= 3) return;
    setSite((s) => ({
      ...s,
      points: s.points.filter((_, k) => k !== i),
      edges: s.edges.filter((e) => e.index !== i).map((e) => (e.index > i ? { ...e, index: e.index - 1 } : e)),
    }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <SurveyImport
          onResult={(s) =>
            setProject((p) => ({
              ...p,
              site: { ...p.site, ...s },
              grid: { baseEdge: (s.edges ?? []).find((e) => e.road)?.index ?? 0, u: 0.455, v: 0.455 },
            }))
          }
        />

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">敷地の数字</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="label">面積（測量図の値）m²</span>
              <input
                type="number"
                step="0.01"
                className="field"
                value={site.areaOverride ?? ""}
                placeholder={round(areaCalc, 2).toString()}
                onChange={(e) =>
                  setSite((s) => ({ ...s, areaOverride: e.target.value === "" ? undefined : Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <span className="label">座標からの計算値</span>
              <div className="py-1 text-slate-600">{round(areaCalc, 2)} m²</div>
            </div>
            <div>
              <span className="label">建ぺい率 %</span>
              <input type="number" className="field" value={site.coverageRatio} onChange={(e) => setSite((s) => ({ ...s, coverageRatio: Number(e.target.value) }))} />
            </div>
            <div>
              <span className="label">容積率 %</span>
              <input type="number" className="field" value={site.farRatio} onChange={(e) => setSite((s) => ({ ...s, farRatio: Number(e.target.value) }))} />
            </div>
            <div>
              <span className="label">北の向き（度）</span>
              <input type="number" step="1" className="field" value={site.northDeg} onChange={(e) => setSite((s) => ({ ...s, northDeg: Number(e.target.value) }))} />
            </div>
            <div>
              <span className="label">境界からの離れ m</span>
              <input type="number" step="0.1" className="field" value={site.setback} onChange={(e) => setSite((s) => ({ ...s, setback: Number(e.target.value) }))} />
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={site.fireproofException} onChange={(e) => setSite((s) => ({ ...s, fireproofException: e.target.checked }))} />
            <span>防火・準防火地域で外壁が耐火構造（建築基準法65条）。境界に接して建てられるため離れ線を出さない</span>
          </label>
        </div>

        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">境界点と辺</h3>
            <span className="text-[11px] text-slate-400">図の上で点をドラッグしても動かせます</span>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {site.points.map((p, i) => {
              const e = edgeOf(i);
              const next = site.points[(i + 1) % site.points.length];
              const calcLen = dist(p, next);
              return (
                <div key={i} className="rounded border border-slate-200 p-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-8 font-semibold">P{i + 1}</span>
                    <input type="number" step="0.01" className="field" value={p.x} onChange={(ev) => setSite((s) => ({ ...s, points: s.points.map((q, k) => (k === i ? { ...q, x: Number(ev.target.value) } : q)) }))} title="東西 m" />
                    <input type="number" step="0.01" className="field" value={p.y} onChange={(ev) => setSite((s) => ({ ...s, points: s.points.map((q, k) => (k === i ? { ...q, y: Number(ev.target.value) } : q)) }))} title="南北 m" />
                    <button className="btn-ghost px-2" title="この点の後に点を追加" onClick={() => addPoint(i)}>＋</button>
                    <button className="btn-ghost px-2 text-red-500" title="この点を削除" onClick={() => removePoint(i)}>－</button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 pl-8">
                    <span className="text-slate-500">辺 P{i + 1}→P{((i + 1) % site.points.length) + 1}</span>
                    <input type="number" step="0.01" className="field w-20" value={e.length ?? ""} placeholder={round(calcLen, 2).toString()} onChange={(ev) => setEdge(i, { length: ev.target.value === "" ? undefined : Number(ev.target.value) })} title="測量図の辺長 m" />
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!e.road} onChange={(ev) => setEdge(i, { road: ev.target.checked, roadWidth: e.roadWidth ?? 4, roadLabel: e.roadLabel ?? "公道" })} />
                      道路
                    </label>
                    {e.road && (
                      <>
                        <input type="number" step="0.1" className="field w-16" value={e.roadWidth ?? 4} onChange={(ev) => setEdge(i, { roadWidth: Number(ev.target.value) })} title="幅員 m" />
                        <input className="field w-32" value={e.roadLabel ?? ""} placeholder="法42条1項1号 公道" onChange={(ev) => setEdge(i, { roadLabel: ev.target.value })} />
                      </>
                    )}
                    <input className="field w-24" value={e.note ?? ""} placeholder="メモ(NTT柱有)" onChange={(ev) => setEdge(i, { note: ev.target.value })} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card text-xs text-slate-500">
          建物の枠と建ぺい率は、次の「建築可能範囲」画面で910mmグリッドの上に置きます。
          <label className="mt-2 flex items-center gap-1">
            <input type="checkbox" checked={showSetback} onChange={(e) => setShowSetback(e.target.checked)} />
            離れ線（{site.setback} m）を表示
          </label>
        </div>
      </aside>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            <b>{project.name}</b> 敷地図　{round(area, 2)} m²（{round(area / TSUBO_M2, 2)}坪）
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => svgRef.current && downloadSvgAsPng(svgRef.current, `${project.name}_敷地図.png`)}>PNG保存</button>
            <button
              className="btn-ghost"
              onClick={() => {
                const xml = new XMLSerializer().serializeToString(svgRef.current!);
                const blob = new Blob([xml], { type: "image/svg+xml" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${project.name}_敷地図.svg`;
                a.click();
              }}
            >
              SVG保存
            </button>
          </div>
        </div>
        <div className="card overflow-auto p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mx-auto max-h-[78vh] w-full touch-none select-none"
            style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
          >
            <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
            <g transform={`rotate(${-site.northDeg} ${W / 2} ${H / 2})`}>
              {/* 道路帯 */}
              {site.edges
                .filter((e) => e.road)
                .map((e) => {
                  const i = e.index;
                  if (i >= site.points.length) return null;
                  const a = site.points[i];
                  const b = site.points[(i + 1) % site.points.length];
                  const n = outwardNormal(i);
                  const w = e.roadWidth ?? 4;
                  // 道路帯は辺の延長線上に長く引く
                  const ext = 30;
                  const dx = (b.x - a.x) / (dist(a, b) || 1);
                  const dy = (b.y - a.y) / (dist(a, b) || 1);
                  const a2 = { x: a.x - dx * ext, y: a.y - dy * ext };
                  const b2 = { x: b.x + dx * ext, y: b.y + dy * ext };
                  const p1 = toPx(a2);
                  const p2 = toPx(b2);
                  const p3 = toPx({ x: b2.x + n.x * w, y: b2.y + n.y * w });
                  const p4 = toPx({ x: a2.x + n.x * w, y: a2.y + n.y * w });
                  const mid = toPx({ x: (a.x + b.x) / 2 + n.x * (w / 2), y: (a.y + b.y) / 2 + n.y * (w / 2) });
                  const q1 = toPx({ x: (a.x + b.x) / 2 + n.x * 0.15, y: (a.y + b.y) / 2 + n.y * 0.15 });
                  const q2 = toPx({ x: (a.x + b.x) / 2 + n.x * (w - 0.15), y: (a.y + b.y) / 2 + n.y * (w - 0.15) });
                  const lines = Array.from({ length: 14 }, (_, k) => k);
                  return (
                    <g key={"road" + i}>
                      <defs>
                        <clipPath id={`roadclip${i}`}>
                          <polygon points={[p1, p2, p3, p4].map((p) => `${p.x},${p.y}`).join(" ")} />
                        </clipPath>
                      </defs>
                      <polygon points={[p1, p2, p3, p4].map((p) => `${p.x},${p.y}`).join(" ")} fill="#e9ecf1" />
                      <g clipPath={`url(#roadclip${i})`} stroke="#c9ced8" strokeWidth={1}>
                        {lines.map((k) => {
                          const t = (k - 2) / 10;
                          const sx = a2.x + (b2.x - a2.x) * t;
                          const sy = a2.y + (b2.y - a2.y) * t;
                          const s1 = toPx({ x: sx - n.x * 2, y: sy - n.y * 2 });
                          const s2 = toPx({ x: sx + n.x * (w + 2), y: sy + n.y * (w + 2) });
                          return <line key={k} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} />;
                        })}
                      </g>
                      <line x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} stroke="#333" strokeWidth={1} markerStart="url(#arrowS)" markerEnd="url(#arrowE)" />
                      <text x={mid.x} y={mid.y - 10} textAnchor="middle" fontSize={15} fontWeight={600} fill="#222">約{w.toFixed(1)}m</text>
                      <text x={mid.x} y={mid.y + 14} textAnchor="middle" fontSize={13} fill="#333">{(e.roadLabel ?? "公道").split(" ").slice(-1)[0]}</text>
                      {(e.roadLabel ?? "").split(" ").length > 1 && (
                        <text x={mid.x} y={mid.y + 32} textAnchor="middle" fontSize={11} fill="#444" writingMode="tb" style={{ display: "none" }}>{e.roadLabel}</text>
                      )}
                      <text x={mid.x} y={mid.y + 60} textAnchor="middle" fontSize={11} fill="#333">
                        {(e.roadLabel ?? "").split(" ").slice(0, -1).join(" ")}
                      </text>
                    </g>
                  );
                })}

              <defs>
                <marker id="arrowE" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#333" />
                </marker>
                <marker id="arrowS" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
                  <path d="M8,0 L0,4 L8,8 z" fill="#333" />
                </marker>
              </defs>

              {/* 敷地 */}
              <polygon points={polyPx.map((p) => `${p.x},${p.y}`).join(" ")} fill="#f6ead3" stroke="#1b2430" strokeWidth={3} strokeLinejoin="round" />

              {/* 離れ線 */}
              {showSetback && !site.fireproofException && (
                <polygon points={setbackPoly.map(toPx).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#c0392b" strokeWidth={1} strokeDasharray="6 4" />
              )}

              {/* 辺の寸法 */}
              {site.points.map((a, i) => {
                const b = site.points[(i + 1) % site.points.length];
                const e = edgeOf(i);
                const len = e.length ?? dist(a, b);
                if (len < 0.05) return null;
                const n = outwardNormal(i);
                const short = len < 1.0;
                const off = e.road ? -0.55 : short ? 1.1 : 0.75; // 道路側は内側、短い辺は外側に離して書く
                const pa = toPx({ x: a.x + n.x * off, y: a.y + n.y * off });
                const pb = toPx({ x: b.x + n.x * off, y: b.y + n.y * off });
                const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
                let ang = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
                if (ang > 90 || ang < -90) ang += 180;
                return (
                  <g key={"dim" + i}>
                    {!e.road && !short && (
                      <>
                        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#555" strokeWidth={1} markerStart="url(#arrowS)" markerEnd="url(#arrowE)" />
                        <line x1={toPx(a).x} y1={toPx(a).y} x2={pa.x} y2={pa.y} stroke="#999" strokeWidth={0.6} />
                        <line x1={toPx(b).x} y1={toPx(b).y} x2={pb.x} y2={pb.y} stroke="#999" strokeWidth={0.6} />
                      </>
                    )}
                    <text
                      x={mid.x}
                      y={mid.y + (short ? 4 : -6)}
                      textAnchor="middle"
                      fontSize={short ? 12 : 15}
                      fontWeight={600}
                      fill="#222"
                      transform={`rotate(${ang} ${mid.x} ${mid.y})`}
                    >
                      {round(len, 2).toFixed(2)}m
                    </text>
                    {e.note && (
                      <g>
                        <circle cx={toPx(a).x} cy={toPx(a).y} r={5} fill="#111" />
                        <text x={toPx(a).x - 16} y={toPx(a).y - 24} textAnchor="end" fontSize={11} fill="#333">
                          {e.note}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 面積 */}
              <text x={cen.x} y={cen.y - 4} textAnchor="middle" fontSize={34} fontWeight={700} fill="#1b2430">
                {round(area, 2).toFixed(2)}m²
              </text>
              <line x1={cen.x - 70} y1={cen.y + 8} x2={cen.x + 70} y2={cen.y + 8} stroke="#1b2430" strokeWidth={1} />
              <text x={cen.x} y={cen.y + 34} textAnchor="middle" fontSize={22} fill="#1b2430">
                ({round(area / TSUBO_M2, 2).toFixed(2)}坪)
              </text>

              {/* 境界点（ドラッグ可） */}
              {polyPx.map((p, i) => (
                <circle
                  key={"pt" + i}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="#fff"
                  stroke="#1b2430"
                  strokeWidth={2}
                  className="cursor-grab"
                  onPointerDown={(e) => {
                    setDrag({ kind: "pt", i });
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                />
              ))}
            </g>

            {/* 方位（回転しない位置に置き、矢印だけ回す） */}
            <g transform={`translate(${W - 50} 50)`}>
              <circle r={22} fill="#fff" stroke="#333" strokeWidth={1} />
              <g>
                <polygon points="0,-18 7,6 0,2 -7,6" fill="#111" />
                <polygon points="0,-18 7,6 0,2" fill="#fff" stroke="#111" strokeWidth={0.5} />
              </g>
              <text y={-28} textAnchor="middle" fontSize={14} fontWeight={700}>N</text>
            </g>
          </svg>
        </div>
      </section>
    </div>
  );
}

function Num({ label, v, onChange, step = 0.1 }: { label: string; v: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input type="number" step={step} className="field" value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
