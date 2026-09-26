"use client";

import { useRef, useState } from "react";
import type { Project, Face, Opening, Building } from "@/lib/types";
import { heightLimits, levels } from "@/lib/heightLimits";
import HeightCheck from "./HeightCheck";
import { faceLength, roofRise, round, faceCompass, roadFaceOf } from "@/lib/geometry";
import { downloadSvgAsPng, uid } from "@/lib/store";
import { derivedOpenings } from "@/lib/openings";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

/** 建物は「建築可能範囲」の底辺に合わせて置くので、面は底辺基準で呼ぶ */
const FACE_BASE: Record<Face, string> = { S: "底辺側", N: "奥側", W: "左側", E: "右側" };
/** 面を外から見たとき、左側と右側にある面 */
const SIDES_FACE: Record<Face, [Face, Face]> = { N: ["E", "W"], S: ["W", "E"], E: ["S", "N"], W: ["N", "S"] };
export function elevationTitle(project: Project) {
  const b = project.building;
  return `${project.name}　${b.structureLabel}　立面図　${b.wallLabel.split("（")[0]} × ${b.accentLabel.split("の")[0]}　基礎${Math.round(b.foundation * 1000)}・天井高${b.floorHeights.slice(0, b.floors).map((h) => Math.round(h * 1000).toLocaleString()).join("/")}・${b.roof === "shed" ? `片流れ${b.roofPitchSun}寸（${FACE_BASE[b.roofHighSide]}が高い）` : b.roof === "gable" ? `切妻${b.roofPitchSun}寸` : "陸屋根"}　※概略図`;
}
function faceTitle(project: Project, face: Face) {
  return `${FACE_BASE[face]}立面図（${faceCompass(project.building, face, project.site.northDeg)}）`;
}
export { levels };

export default function Elevation({ project, setProject }: Props) {
  const { building: b, openings, site } = project;
  const [editFace, setEditFace] = useState<Face>("S");
  const [sel, setSel] = useState<string | null>(null);
  const allRef = useRef<SVGSVGElement>(null);
  const faceRefs = useRef<Record<Face, SVGSVGElement | null>>({ N: null, S: null, E: null, W: null });

  const setB = (patch: Partial<Building>) => setProject((p) => ({ ...p, building: { ...p.building, ...patch } }));
  const setOpening = (id: string, patch: Partial<Opening>) => setProject((p) => ({ ...p, openings: p.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const addOpening = (kind: Opening["kind"]) => {
    const o: Opening = { id: uid(), face: editFace, floor: 1, offset: 1, width: kind === "garage" ? 2.5 : kind === "slit" ? 0.4 : 1.6, height: kind === "door" || kind === "garage" ? 2.2 : kind === "slit" ? 2.0 : 1.2, sill: kind === "door" || kind === "garage" ? 0 : 0.9, kind };
    setProject((p) => ({ ...p, openings: [...p.openings, o] }));
    setSel(o.id);
  };

  const roadFace: Face | null = roadFaceOf(site, b);

  const title = elevationTitle(project);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">建物の高さと屋根</h3>
          <div className="grid grid-cols-2 gap-2">
            <Num label="階数" v={b.floors} step={1} onChange={(v) => { const n = Math.max(1, Math.min(4, Math.round(v))); const fh = [...b.floorHeights]; while (fh.length < n) fh.push(2.3); setB({ floors: n, floorHeights: fh }); }} />
            <Num label="基礎高 m" v={b.foundation} step={0.05} onChange={(v) => setB({ foundation: v })} />
            {Array.from({ length: b.floors }, (_, i) => (
              <Num key={i} label={`${i + 1}階 天井高 m`} v={b.floorHeights[i] ?? 2.3} step={0.05} onChange={(v) => { const fh = [...b.floorHeights]; fh[i] = v; setB({ floorHeights: fh }); }} />
            ))}
            <div>
              <span className="label">屋根</span>
              <select className="field" value={b.roof} onChange={(e) => setB({ roof: e.target.value as Building["roof"] })}>
                <option value="shed">片流れ</option>
                <option value="flat">陸屋根（フラット）</option>
                <option value="gable">切妻</option>
              </select>
            </div>
            {b.roof !== "flat" && (
              <>
                <Num label="勾配（寸）" v={b.roofPitchSun} step={0.5} onChange={(v) => setB({ roofPitchSun: v })} />
                <Num label="軒の出 m（斜線は軒先で判定）" v={b.eaveOverhang ?? 0} step={0.05} onChange={(v) => setB({ eaveOverhang: v })} />
                <div>
                  <span className="label">{b.roof === "shed" ? "高い側（軒ゼロ側の反対）" : "棟の向き"}</span>
                  <select className="field" value={b.roofHighSide} onChange={(e) => setB({ roofHighSide: e.target.value as Building["roofHighSide"] })}>
                    {(["S", "N", "W", "E"] as Face[]).map((f) => (
                      <option key={f} value={f}>{FACE_BASE[f]}（{faceCompass(b, f, site.northDeg)}）</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {(() => { const lv = levels(b); return <>GL±0 ／ {lv.fl.map((h, i) => `${i + 1}FL +${Math.round(h * 1000).toLocaleString()}`).join(" ／ ")} ／ 軒高 +{Math.round(lv.eave * 1000).toLocaleString()} ／ 最高高さ +{Math.round(lv.max * 1000).toLocaleString()}</>; })()}
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">外観の仕様（凡例に出ます）</h3>
          <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs">
            <input type="color" value={b.wallColor} onChange={(e) => setB({ wallColor: e.target.value })} />
            <input className="field" value={b.wallLabel} onChange={(e) => setB({ wallLabel: e.target.value })} placeholder="外壁：ガルバリウム鋼板 縦張り（黒・つや消し）" />
            <input type="color" value={b.accentColor} onChange={(e) => setB({ accentColor: e.target.value })} />
            <input className="field" value={b.accentLabel} onChange={(e) => setB({ accentLabel: e.target.value })} placeholder="木目調の軒天・玄関ドア" />
            <span className="text-slate-500">構造</span>
            <input className="field" value={b.structureLabel} onChange={(e) => setB({ structureLabel: e.target.value })} placeholder="木造3階建て" />
          </div>
        </div>

        <HeightCheck project={project} setProject={setProject} />

        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">窓・ドア（追加分）</h3>
            <div className="flex gap-1">
              {(["S", "N", "W", "E"] as Face[]).map((f) => (
                <button key={f} className={`rounded px-2 py-0.5 text-xs ${editFace === f ? "bg-brand-600 text-white" : "bg-slate-100"}`} onClick={() => setEditFace(f)}>
                  {FACE_BASE[f]}{roadFace === f ? "(道路)" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 text-xs">
            <button className="btn-ghost" onClick={() => addOpening("window")}>＋窓</button>
            <button className="btn-ghost" onClick={() => addOpening("slit")}>＋縦スリット窓</button>
            <button className="btn-ghost" onClick={() => addOpening("door")}>＋玄関ドア</button>
            <button className="btn-ghost" onClick={() => addOpening("garage")}>＋ガレージ開口</button>
          </div>
          {derivedOpenings(project).filter((o) => o.face === editFace).length > 0 && (
            <div className="rounded bg-slate-50 p-1.5 text-[11px] text-slate-600">
              <div className="mb-0.5 font-medium">間取り図の建具から（編集は間取り図で）</div>
              {derivedOpenings(project).filter((o) => o.face === editFace).map((o) => (
                <div key={o.id}>{o.floor}F {o.kind === "door" ? "ドア" : o.kind === "garage" ? "開口" : "窓"} 幅{Math.round(o.width * 1000)} 高さ{Math.round(o.height * 1000)} 左から{o.offset.toFixed(2)}m</div>
              ))}
            </div>
          )}
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {openings.filter((o) => o.face === editFace).map((o) => (
              <div key={o.id} className={`rounded border p-1.5 text-[11px] ${sel === o.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`} onClick={() => setSel(o.id)}>
                <div className="flex items-center gap-1">
                  <select className="field w-20" value={o.kind} onChange={(e) => setOpening(o.id, { kind: e.target.value as Opening["kind"] })}>
                    <option value="window">窓</option>
                    <option value="slit">スリット</option>
                    <option value="door">ドア</option>
                    <option value="garage">ガレージ</option>
                  </select>
                  <select className="field w-14" value={o.floor} onChange={(e) => setOpening(o.id, { floor: Number(e.target.value) })}>
                    {Array.from({ length: b.floors }, (_, i) => i + 1).map((l) => <option key={l} value={l}>{l}F</option>)}
                  </select>
                  <button className="btn-ghost px-2 text-red-500" onClick={(e) => { e.stopPropagation(); setProject((p) => ({ ...p, openings: p.openings.filter((x) => x.id !== o.id) })); }}>✕</button>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  <NumI label="左から" v={o.offset} onChange={(v) => setOpening(o.id, { offset: v })} />
                  <NumI label="幅" v={o.width} onChange={(v) => setOpening(o.id, { width: v })} />
                  <NumI label="高さ" v={o.height} onChange={(v) => setOpening(o.id, { height: v })} />
                  <NumI label="床から" v={o.sill} onChange={(v) => setOpening(o.id, { sill: v })} />
                </div>
              </div>
            ))}
            {openings.filter((o) => o.face === editFace).length === 0 && <div className="text-xs text-slate-400">追加の窓はありません（間取り図の窓は自動で反映）</div>}
          </div>
          <p className="text-[11px] text-slate-500">「左から」は、その面を外から見て左端からの距離です。</p>
        </div>
      </aside>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600"><b>{project.name}</b> 立面図</div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => allRef.current && downloadSvgAsPng(allRef.current, `${project.name}_立面図4面.png`, 2)}>4面まとめてPNG</button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(["S", "N", "W", "E"] as Face[]).map((f) => (
            <div key={f} className={`card p-2 ${editFace === f ? "ring-2 ring-brand-100" : ""}`} onClick={() => setEditFace(f)}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <b>{faceTitle(project, f)}{roadFace === f ? "（道路側）" : ""}</b>
                <button className="text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); const s = faceRefs.current[f]; if (s) downloadSvgAsPng(s, `${project.name}_${faceTitle(project, f)}.png`); }}>PNG</button>
              </div>
              <ElevationSvg ref={(el) => { faceRefs.current[f] = el; }} project={project} face={f} sel={sel} onSelect={setSel} />
            </div>
          ))}
        </div>
        <div className="hidden">
          <AllElevationsSvg ref={allRef} project={project} title={title} roadFace={roadFace} />
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
function NumI({ label, v, onChange }: { label: string; v: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col">
      <span className="text-[9px] text-slate-400">{label}</span>
      <input type="number" step="0.1" className="field px-1 py-0.5" value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

import { forwardRef } from "react";

/** 1面の立面図（SVG）。px = 1m あたりのピクセル */
export const ElevationSvg = forwardRef<SVGSVGElement, { project: Project; face: Face; sel?: string | null; onSelect?: (id: string) => void; px?: number; standalone?: boolean }>(
  function ElevationSvg({ project, face, sel, onSelect, px = 40, standalone = true }, ref) {
    const b = project.building;
    const lv = levels(b);
    const len = faceLength(b, face);
    const rise = roofRise(b);
    const W = len * px + 200;
    const H = lv.max * px + 70;
    const ox = 60;
    const gl = H - 30;
    const X = (m: number) => ox + m * px;
    const Y = (m: number) => gl - m * px;

    // 屋根の形（この面から見た輪郭）
    // 片流れ: 高い側が左右どちらか or 手前/奥（水平線）
    const [leftF, rightF] = SIDES_FACE[face];
    const leftSide = faceCompass(b, leftF, project.site.northDeg);
    const rightSide = faceCompass(b, rightF, project.site.northDeg);
    let roofPath = "";
    let leftTop = lv.eave;
    let rightTop = lv.eave;
    if (b.roof === "shed") {
      if (b.roofHighSide === leftF) leftTop = lv.eave + rise;
      else if (b.roofHighSide === rightF) rightTop = lv.eave + rise;
      else if (b.roofHighSide === face) {
        leftTop = rightTop = lv.eave + rise;
      }
      roofPath = `M ${X(0)} ${Y(leftTop)} L ${X(len)} ${Y(rightTop)}`;
    } else if (b.roof === "gable") {
      const ridgeAlong = b.roofHighSide === "N" || b.roofHighSide === "S" ? "NS" : "EW";
      const seesGable = (ridgeAlong === "NS" && (face === "N" || face === "S")) || (ridgeAlong === "EW" && (face === "E" || face === "W"));
      if (seesGable) roofPath = `M ${X(0)} ${Y(lv.eave)} L ${X(len / 2)} ${Y(lv.eave + rise)} L ${X(len)} ${Y(lv.eave)}`;
      else {
        leftTop = rightTop = lv.eave + rise;
        roofPath = `M ${X(0)} ${Y(leftTop)} L ${X(len)} ${Y(rightTop)}`;
      }
    } else {
      leftTop = rightTop = lv.eave + 0.15;
      roofPath = `M ${X(0)} ${Y(leftTop)} L ${X(len)} ${Y(rightTop)}`;
    }
    const wallPoly = b.roof === "gable" && roofPath.includes("L") && roofPath.split("L").length === 3
      ? `${X(0)},${Y(lv.eave)} ${X(len / 2)},${Y(lv.eave + rise)} ${X(len)},${Y(lv.eave)} ${X(len)},${Y(b.foundation)} ${X(0)},${Y(b.foundation)}`
      : `${X(0)},${Y(leftTop)} ${X(len)},${Y(rightTop)} ${X(len)},${Y(b.foundation)} ${X(0)},${Y(b.foundation)}`;

    const ops = [...derivedOpenings(project), ...project.openings].filter((o) => o.face === face);
    const marks: [string, number][] = [["GL ±0", 0], ...lv.fl.map((h, i) => [`${i + 1}FL +${Math.round(h * 1000).toLocaleString()}`, h] as [string, number]), ["軒高 +" + Math.round(lv.eave * 1000).toLocaleString(), lv.eave], ["最高高さ +" + Math.round(lv.max * 1000).toLocaleString(), lv.max]];

    return (
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}>
        {standalone && <rect width={W} height={H} fill="#fff" />}
        {standalone && <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700}>{faceTitle(project, face)}</text>}
        {/* 縦板張りのパターン */}
        <defs>
          <pattern id={`siding-${face}`} width={6} height={6} patternUnits="userSpaceOnUse">
            <rect width={6} height={6} fill={b.wallColor} />
            <line x1={0} y1={0} x2={0} y2={6} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          </pattern>
        </defs>
        {/* 基準線 */}
        {marks.map(([label, h]) => (
          <g key={label}>
            <line x1={ox - 30} y1={Y(h)} x2={X(len) + 20} y2={Y(h)} stroke="#bbb" strokeWidth={0.6} strokeDasharray="4 3" />
            <text x={X(len) + 24} y={Y(h) + 4} fontSize={9} fill="#555">▽{label}</text>
          </g>
        ))}
        {/* 地盤 */}
        <line x1={20} y1={gl} x2={W - 20} y2={gl} stroke="#333" strokeWidth={1.5} />
        {Array.from({ length: Math.floor((W - 40) / 8) }, (_, i) => (
          <line key={i} x1={20 + i * 8} y1={gl} x2={14 + i * 8} y2={gl + 6} stroke="#333" strokeWidth={0.6} />
        ))}
        {/* 基礎 */}
        <rect x={X(0)} y={Y(b.foundation)} width={len * px} height={b.foundation * px} fill="#5f6670" stroke="#222" strokeWidth={1} />
        {/* 外壁 */}
        <polygon points={wallPoly} fill={`url(#siding-${face})`} stroke="#111" strokeWidth={1.5} />
        {/* 奥へ上る片流れ: 屋根面が帯として見える */}
        {b.roof === "shed" && b.roofHighSide !== face && b.roofHighSide !== leftF && b.roofHighSide !== rightF && (
          <g>
            <rect x={X(0)} y={Y(lv.eave + rise)} width={len * px} height={rise * px} fill="#3a3f47" stroke="#111" strokeWidth={1} />
            <text x={X(len / 2)} y={Y(lv.eave + rise / 2) + 4} textAnchor="middle" fontSize={9} fill="#ddd">屋根面（奥へ上る片流れ）</text>
          </g>
        )}
        {/* 屋根の笠木 */}
        <path d={roofPath} stroke="#111" strokeWidth={4} fill="none" />
        {/* 開口 */}
        {ops.map((o) => {
          const base = lv.fl[o.floor - 1] ?? lv.fl[0];
          const x = X(o.offset);
          const y = Y(base + o.sill + o.height);
          const w = o.width * px;
          const h = o.height * px;
          const isSel = sel === o.id;
          if (o.kind === "door") {
            return (
              <g key={o.id} onPointerDown={() => onSelect?.(o.id)} className={onSelect ? "cursor-pointer" : ""}>
                <rect x={x - 0.4 * px} y={Y(base + o.height + 0.25)} width={w + 0.9 * px} height={0.25 * px} fill={b.accentColor} stroke="#111" strokeWidth={0.8} />
                <rect x={x - 0.4 * px} y={y} width={0.4 * px} height={h} fill={b.accentColor} stroke="#111" strokeWidth={0.8} />
                <rect x={x} y={y} width={w} height={h} fill="#cfe2f0" stroke="#111" strokeWidth={1} />
                <rect x={x + w * 0.35} y={y} width={w * 0.65} height={h} fill={b.accentColor} stroke="#111" strokeWidth={0.8} />
                {isSel && <rect x={x - 0.4 * px - 2} y={y - 2} width={w + 0.9 * px + 4} height={h + 4} fill="none" stroke="#2f6fed" strokeWidth={2} />}
              </g>
            );
          }
          if (o.kind === "garage") {
            return (
              <g key={o.id} onPointerDown={() => onSelect?.(o.id)} className={onSelect ? "cursor-pointer" : ""}>
                <rect x={x - 4} y={y - 0.25 * px} width={w + 8} height={0.25 * px} fill={b.accentColor} stroke="#111" strokeWidth={0.8} />
                <rect x={x} y={y} width={w} height={h} fill="#2a2f38" stroke="#111" strokeWidth={1} />
                <rect x={x + w * 0.2} y={y + h * 0.25} width={w * 0.6} height={h * 0.7} rx={6} fill="#4f7ea8" stroke="#1d3446" />
                <rect x={x + w * 0.27} y={y + h * 0.33} width={w * 0.46} height={h * 0.22} rx={3} fill="#dbe9f5" />
                {isSel && <rect x={x - 6} y={y - 0.25 * px - 2} width={w + 12} height={h + 0.25 * px + 4} fill="none" stroke="#2f6fed" strokeWidth={2} />}
              </g>
            );
          }
          return (
            <g key={o.id} onPointerDown={() => onSelect?.(o.id)} className={onSelect ? "cursor-pointer" : ""}>
              <rect x={x} y={y} width={w} height={h} fill="#bcd3e6" stroke="#111" strokeWidth={1.2} />
              {o.kind === "window" && w > 30 && <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#111" strokeWidth={1} />}
              <line x1={x + 3} y1={y + h - 3} x2={x + w * 0.4} y2={y + 3} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
              {isSel && <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} fill="none" stroke="#2f6fed" strokeWidth={2} />}
            </g>
          );
        })}
        {/* 高さ制限ライン（参考） */}
        {heightLimits(project, face).map((lim, i) => {
          const pts: string[] = [];
          for (let k = 0; k <= 24; k++) {
            const m = (len * k) / 24;
            const h = lim.hAt(m);
            if (h === null) continue;
            pts.push(`${X(m)},${Y(Math.min(h, lv.max + 0.5))}`);
          }
          if (pts.length < 2) return null;
          const h0 = lim.hAt(len) ?? lim.hAt(0);
          return (
            <g key={lim.name + i}>
              <polyline points={pts.join(" ")} fill="none" stroke={lim.color} strokeWidth={1.2} strokeDasharray="7 4" />
              <text x={X(len) + 24} y={Y(Math.min(h0 ?? 0, lv.max + 0.5)) - 3} fontSize={8} fill={lim.color}>{lim.name} {h0 !== null ? `+${Math.round(h0 * 1000).toLocaleString()}` : ""}</text>
            </g>
          );
        })}
        {/* 左右の方角 */}
        <text x={ox - 40} y={Y(lv.fl[Math.floor(b.floors / 2)] ?? 3)} textAnchor="middle" fontSize={11} fill="#444">{leftSide}</text>
        <text x={X(len) + 60} y={Y(lv.fl[Math.floor(b.floors / 2)] ?? 3) + 24} textAnchor="middle" fontSize={11} fill="#444">{rightSide}</text>
      </svg>
    );
  }
);

export const AllElevationsSvg = forwardRef<SVGSVGElement, { project: Project; title: string; roadFace: Face | null }>(function AllElevationsSvg({ project, title, roadFace }, ref) {
  const b = project.building;
  const W = 1400;
  const cellW = 680;
  const cellH = Math.max(320, levels(b).max * 30 + 90);
  const H = 60 + cellH * 2 + 80;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}>
      <rect width={W} height={H} fill="#fff" />
      <text x={W / 2} y={34} textAnchor="middle" fontSize={16} fontWeight={700}>{title}</text>
      {(["S", "N", "W", "E"] as Face[]).map((f, i) => {
        const cx = 20 + (i % 2) * cellW;
        const cy = 60 + Math.floor(i / 2) * cellH;
        return (
          <g key={f} transform={`translate(${cx} ${cy})`}>
            <text x={cellW / 2} y={14} textAnchor="middle" fontSize={14} fontWeight={700}>{faceTitle(project, f)}{roadFace === f ? "（道路側）" : ""}</text>
            <svg x={0} y={20} width={cellW - 20} height={cellH - 30} viewBox={`0 0 ${faceLength(b, f) * 30 + 200} ${levels(b).max * 30 + 70}`} preserveAspectRatio="xMidYMid meet">
              <ElevationSvg project={project} face={f} px={30} standalone={false} />
            </svg>
          </g>
        );
      })}
      <g transform={`translate(30 ${H - 50})`} fontSize={11}>
        <rect width={14} height={14} fill={b.wallColor} /><text x={20} y={11}>外壁：{b.wallLabel}</text>
        <rect x={420} width={14} height={14} fill={b.accentColor} /><text x={440} y={11}>{b.accentLabel}</text>
        <rect x={820} width={14} height={14} fill="#bcd3e6" stroke="#111" /><text x={840} y={11}>サッシ：黒枠（道路側は防火設備）</text>
        <rect y={22} width={14} height={14} fill="#5f6670" /><text x={20} y={33}>基礎：濃いグレー仕上げ　笠木・見切り：黒（板金）</text>
        <text x={420} y={33} fill="#666">※概略図。寸法・仕様は設計で確定します。</text>
      </g>
    </svg>
  );
});
