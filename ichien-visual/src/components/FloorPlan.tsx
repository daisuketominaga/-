"use client";

import { useMemo, useRef, useState } from "react";
import type { Project, Room, RoomType, Floor } from "@/lib/types";
import { ROOM_FILL, ROOM_LABEL, TATAMI_M2, TSUBO_M2, HALF, MODULE } from "@/lib/types";
import { round } from "@/lib/geometry";
import { downloadSvgAsPng, uid } from "@/lib/store";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

const PX = 60; // px per m
const snap = (v: number) => Math.round(v / HALF) * HALF;

const ROOM_TYPES: RoomType[] = ["ldk", "living", "kitchen", "bedroom", "japanese", "study", "entrance", "hall", "toilet", "bath", "washroom", "closet", "storage", "stairs", "garage", "balcony", "other"];

export default function FloorPlan({ project, setProject }: Props) {
  const { building } = project;
  const [level, setLevel] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; ox: number; oy: number; ow: number; od: number; sx: number; sy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const allRef = useRef<SVGSVGElement>(null);

  const floor: Floor = project.floors.find((f) => f.level === level) ?? { level, rooms: [] };
  const setFloor = (u: (f: Floor) => Floor) =>
    setProject((p) => {
      const exists = p.floors.some((f) => f.level === level);
      const floors = exists ? p.floors.map((f) => (f.level === level ? u(f) : f)) : [...p.floors, u({ level, rooms: [] })];
      return { ...p, floors: floors.sort((a, b) => a.level - b.level) };
    });
  const updateRoom = (id: string, patch: Partial<Room>) => setFloor((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const W = building.w * PX + 80;
  const H = building.d * PX + 80;
  const ox = 40;
  const oy = 40;
  const toPx = (x: number, y: number) => ({ x: ox + x * PX, y: oy + (building.d - y) * PX });

  const localOf = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: (pt.x - ox) / PX, y: building.d - (pt.y - oy) / PX };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = localOf(e);
    const dx = p.x - drag.sx;
    const dy = p.y - drag.sy;
    if (drag.mode === "move") {
      const nx = Math.max(0, Math.min(building.w - drag.ow, snap(drag.ox + dx)));
      const ny = Math.max(0, Math.min(building.d - drag.od, snap(drag.oy + dy)));
      updateRoom(drag.id, { x: round(nx, 2), y: round(ny, 2) });
    } else {
      const nw = Math.max(0.5, Math.min(building.w - drag.ox, snap(drag.ow + dx)));
      const nd = Math.max(0.5, Math.min(building.d - drag.oy, snap(drag.od - dy)));
      // リサイズのつまみは右下（南東）なので、奥行は下方向に伸ばす＝yを下げる
      const ny = Math.max(0, round(drag.oy + drag.od - nd, 2));
      updateRoom(drag.id, { w: round(nw, 2), d: round(nd, 2), y: ny });
    }
  };

  const floorArea = (f: Floor) => f.rooms.filter((r) => r.type !== "balcony").reduce((a, r) => a + r.w * r.d, 0);
  const balconyArea = (f: Floor) => f.rooms.filter((r) => r.type === "balcony").reduce((a, r) => a + r.w * r.d, 0);
  const total = project.floors.reduce((a, f) => a + floorArea(f), 0);
  const siteArea = project.site.areaOverride ?? 0;

  const summary = useMemo(() => {
    const bedrooms = project.floors.flatMap((f) => f.rooms).filter((r) => r.type === "bedroom" || r.type === "japanese").length;
    const hasLdk = project.floors.flatMap((f) => f.rooms).some((r) => r.type === "ldk");
    const extras = project.floors.flatMap((f) => f.rooms).filter((r) => r.type === "study" || r.type === "garage").map((r) => r.name);
    return `${bedrooms}${hasLdk ? "LDK" : "K"}${extras.length ? "＋" + Array.from(new Set(extras)).join("＋") : ""}`;
  }, [project.floors]);

  const addRoom = (type: RoomType) => {
    const r: Room = { id: uid(), name: ROOM_LABEL[type], type, x: 0, y: 0, w: Math.min(2.73, building.w), d: Math.min(2.73, building.d) };
    setFloor((f) => ({ ...f, rooms: [...f.rooms, r] }));
    setSel(r.id);
  };

  const runAi = async (mode: "edit" | "generate") => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, instruction, project: { building: project.building, floors: project.floors, site: { areaOverride: siteArea, coverageRatio: project.site.coverageRatio, farRatio: project.site.farRatio } }, level }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "失敗しました");
      setProject((p) => ({ ...p, floors: json.floors }));
      setMsg(json.notes || "更新しました");
      setInstruction("");
    } catch (e) {
      setMsg("エラー: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selected = floor.rooms.find((r) => r.id === sel);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">日本語で指示して編集</h3>
          <textarea
            className="field h-20"
            placeholder={`例）\n・1階のガレージをもう50cm広く\n・3階の洋室2つを一つにまとめて8帖に\n・2階にパントリーを追加\n・全部やり直して、1階に和室を入れて`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-primary flex-1 justify-center" disabled={busy || !instruction.trim()} onClick={() => runAi("edit")}>
              {busy ? "考え中…" : "この指示で直す"}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => { if (confirm("今の間取りを捨てて、建物の大きさから間取りを提案させますか？")) runAi("generate"); }}>
              ゼロから提案
            </button>
          </div>
          {msg && <div className={`text-xs ${msg.startsWith("エラー") ? "text-red-600" : "text-emerald-700"}`}>{msg}</div>}
          <p className="text-[11px] text-slate-500">Claude APIを使います（使った時だけ課金）。手で直すのは下の表か、図の上でドラッグ。</p>
        </div>

        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{level}階の部屋</h3>
            <div className="flex gap-1">
              {Array.from({ length: building.floors }, (_, i) => i + 1).map((l) => (
                <button key={l} className={`rounded px-2 py-0.5 text-xs ${level === l ? "bg-brand-600 text-white" : "bg-slate-100"}`} onClick={() => { setLevel(l); setSel(null); }}>
                  {l}F
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {ROOM_TYPES.map((t) => (
              <button key={t} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] hover:bg-slate-50" onClick={() => addRoom(t)} style={{ background: ROOM_FILL[t] }}>
                ＋{ROOM_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {floor.rooms.map((r) => (
              <div key={r.id} className={`rounded border p-1.5 text-xs ${sel === r.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`} onClick={() => setSel(r.id)}>
                <div className="flex items-center gap-1">
                  <input className="field" value={r.name} onChange={(e) => updateRoom(r.id, { name: e.target.value })} />
                  <select className="field w-24" value={r.type} onChange={(e) => updateRoom(r.id, { type: e.target.value as RoomType })}>
                    {ROOM_TYPES.map((t) => (
                      <option key={t} value={t}>{ROOM_LABEL[t]}</option>
                    ))}
                  </select>
                  <button className="btn-ghost px-2 text-red-500" onClick={(e) => { e.stopPropagation(); setFloor((f) => ({ ...f, rooms: f.rooms.filter((x) => x.id !== r.id) })); }}>✕</button>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  <NumI label="X" v={r.x} onChange={(v) => updateRoom(r.id, { x: v })} />
                  <NumI label="Y" v={r.y} onChange={(v) => updateRoom(r.id, { y: v })} />
                  <NumI label="幅" v={r.w} onChange={(v) => updateRoom(r.id, { w: v })} />
                  <NumI label="奥行" v={r.d} onChange={(v) => updateRoom(r.id, { d: v })} />
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">{round(r.w * r.d, 2)} m² ＝ {round((r.w * r.d) / TATAMI_M2, 1)} 帖</div>
              </div>
            ))}
            {floor.rooms.length === 0 && <div className="text-xs text-slate-400">部屋がありません。上のボタンで追加するか「ゼロから提案」を押してください。</div>}
          </div>
          <p className="text-[11px] text-slate-500">外形 {building.w.toFixed(3)}m × {building.d.toFixed(3)}m は「建築可能範囲」画面で決めます。部屋は455mm刻みで動きます。</p>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => { const src = project.floors.find((f) => f.level === level - 1); if (src) setFloor((f) => ({ ...f, rooms: src.rooms.map((r) => ({ ...r, id: uid() })) })); }} disabled={level <= 1}>
              下の階をコピー
            </button>
            <button className="btn-ghost text-xs" onClick={() => setFloor((f) => ({ ...f, rooms: [] }))}>この階をクリア</button>
          </div>
        </div>

        <div className="card text-xs">
          <h3 className="mb-1 text-sm font-semibold">建物参考プラン</h3>
          <table className="w-full">
            <tbody>
              <Row k="間取り" v={summary} />
              <Row k="敷地面積" v={siteArea ? `${round(siteArea, 2)}㎡（${round(siteArea / TSUBO_M2, 2)}坪）` : "未入力"} />
              <Row k="建築面積" v={`${round(building.w * building.d, 2)}㎡`} />
              {project.floors.map((f) => (
                <Row key={f.level} k={`${f.level}階`} v={`${round(floorArea(f), 2)}㎡${balconyArea(f) ? `（＋バルコニー ${round(balconyArea(f), 2)}㎡）` : ""}`} />
              ))}
              <Row k="延床面積" v={`${round(total, 2)}㎡（${round(total / TSUBO_M2, 2)}坪）`} />
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-slate-400">※参考プランです。面積は壁芯計算の概算で、建築には別途設計・建築確認が必要です。</p>
        </div>
      </aside>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            <b>{project.name}</b> 建物参考プラン（{building.structureLabel}）
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => svgRef.current && downloadSvgAsPng(svgRef.current, `${project.name}_${level}階.png`)}>この階をPNG</button>
            <button className="btn-ghost" onClick={() => allRef.current && downloadSvgAsPng(allRef.current, `${project.name}_間取り一式.png`, 2)}>全階まとめてPNG</button>
          </div>
        </div>

        <div className="card overflow-auto p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mx-auto max-h-[70vh] w-full touch-none select-none"
            style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}
            onPointerMove={onMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
            onPointerDown={(e) => { if (e.target === svgRef.current) setSel(null); }}
          >
            <rect width={W} height={H} fill="#fff" />
            <FloorSvg floor={floor} project={project} ox={ox} oy={oy} px={PX} sel={sel} onSelect={setSel} onStartDrag={(r, mode, e) => { const p = localOf(e); setDrag({ id: r.id, mode, ox: r.x, oy: r.y, ow: r.w, od: r.d, sx: p.x, sy: p.y }); }} />
            <text x={ox} y={oy - 14} fontSize={16} fontWeight={700} fill="#222">
              {level}階　床面積 {round(floorArea(floor), 2)}㎡{balconyArea(floor) ? `（バルコニー ${round(balconyArea(floor), 2)}㎡ 別）` : ""}
            </text>
            <NorthMark x={W - 30} y={oy - 10} deg={project.site.northDeg + project.building.rotDeg} />
          </svg>
        </div>

        {/* 書き出し用：全階まとめ（非表示） */}
        <div className="hidden">
          <AllFloorsSvg ref={allRef} project={project} summary={summary} total={total} floorArea={floorArea} balconyArea={balconyArea} />
        </div>

        {selected && (
          <div className="text-xs text-slate-500">
            選択中: <b>{selected.name}</b>　ドラッグで移動、右下の■で大きさ変更。数値は左の表で。
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-dashed border-slate-200">
      <td className="py-1 pr-2 text-slate-500">{k}</td>
      <td className="py-1 font-medium">{v}</td>
    </tr>
  );
}

function NumI({ label, v, onChange }: { label: string; v: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      <input type="number" step="0.455" className="field px-1 py-0.5" value={v} onChange={(e) => onChange(Math.round((Number(e.target.value) / 0.455)) * 0.455)} />
    </label>
  );
}

/** deg = 画面上を0として時計回りの度数 */
export function NorthMark({ x, y, deg }: { x: number; y: number; deg: number }) {
  const r = (deg * Math.PI) / 180;
  const tx = Math.sin(r) * 26;
  const ty = -Math.cos(r) * 26;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`rotate(${deg})`}>
        <line x1={0} y1={8} x2={0} y2={-14} stroke="#333" strokeWidth={1.2} />
        <polygon points="0,-18 4,-8 -4,-8" fill="#333" />
      </g>
      <text x={tx} y={ty + 4} textAnchor="middle" fontSize={11} fontWeight={700}>N</text>
    </g>
  );
}

/** 1フロア分の間取り描画 */
export function FloorSvg({ floor, project, ox, oy, px, sel, onSelect, onStartDrag, compact }: {
  floor: Floor;
  project: Project;
  ox: number;
  oy: number;
  px: number;
  sel?: string | null;
  onSelect?: (id: string) => void;
  onStartDrag?: (r: Room, mode: "move" | "resize", e: React.PointerEvent) => void;
  compact?: boolean;
}) {
  const b = project.building;
  const toPx = (x: number, y: number) => ({ x: ox + x * px, y: oy + (b.d - y) * px });
  const wallW = compact ? 4 : 6;
  return (
    <g>
      {/* 外壁と910グリッド */}
      <rect x={ox} y={oy} width={b.w * px} height={b.d * px} fill="#fbf7ef" stroke="#1b1b1b" strokeWidth={wallW} />
      {Array.from({ length: Math.floor(b.w / HALF) }, (_, i) => (i + 1) * HALF).map((u) => (
        <line key={"gu" + u} x1={ox + u * px} y1={oy} x2={ox + u * px} y2={oy + b.d * px} stroke={Math.abs((u / MODULE) % 1) < 1e-6 ? "#d8dee8" : "#eef1f5"} strokeWidth={0.8} />
      ))}
      {Array.from({ length: Math.floor(b.d / HALF) }, (_, i) => (i + 1) * HALF).map((v) => (
        <line key={"gv" + v} x1={ox} y1={oy + (b.d - v) * px} x2={ox + b.w * px} y2={oy + (b.d - v) * px} stroke={Math.abs((v / MODULE) % 1) < 1e-6 ? "#d8dee8" : "#eef1f5"} strokeWidth={0.8} />
      ))}
      {floor.rooms.map((r) => {
        const p = toPx(r.x, r.y + r.d);
        const w = r.w * px;
        const h = r.d * px;
        const isSel = sel === r.id;
        const tatami = (r.w * r.d) / TATAMI_M2;
        const showTatami = ["ldk", "living", "bedroom", "japanese", "study"].includes(r.type);
        return (
          <g key={r.id} onPointerDown={(e) => { e.stopPropagation(); onSelect?.(r.id); onStartDrag?.(r, "move", e); }} className={onStartDrag ? "cursor-move" : ""}>
            <rect x={p.x} y={p.y} width={w} height={h} fill={ROOM_FILL[r.type]} stroke={isSel ? "#2f6fed" : "#1b1b1b"} strokeWidth={isSel ? 3 : 2.5} />
            {r.type === "stairs" && <StairLines x={p.x} y={p.y} w={w} h={h} px={px} />}
            <text x={p.x + w / 2} y={p.y + h / 2 + (showTatami ? -2 : 4)} textAnchor="middle" fontSize={Math.min(compact ? 12 : 15, Math.max(8, w / 5))} fontWeight={700} fill="#222" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={3} paintOrder="stroke">
              {r.name}
            </text>
            {showTatami && (
              <text x={p.x + w / 2} y={p.y + h / 2 + (compact ? 12 : 16)} textAnchor="middle" fontSize={compact ? 10 : 13} fill="#333" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {round(tatami, 1).toFixed(1)}帖
              </text>
            )}
            {isSel && onStartDrag && (
              <rect x={p.x + w - 8} y={p.y + h - 8} width={10} height={10} fill="#2f6fed" className="cursor-nwse-resize" onPointerDown={(e) => { e.stopPropagation(); onStartDrag(r, "resize", e); }} />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** 階段だけは段の線を入れる（家具は描かない） */
function StairLines({ x, y, w, h, px }: { x: number; y: number; w: number; h: number; px: number }) {
  const n = Math.max(6, Math.floor(h / (0.23 * px)));
  return (
    <g stroke="#666" strokeWidth={0.8}>
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1={x} y1={y + ((i + 1) * h) / (n + 1)} x2={x + w} y2={y + ((i + 1) * h) / (n + 1)} />
      ))}
    </g>
  );
}

import { forwardRef } from "react";

export const AllFloorsSvg = forwardRef<SVGSVGElement, { project: Project; summary: string; total: number; floorArea: (f: Floor) => number; balconyArea: (f: Floor) => number }>(
  function AllFloorsSvg({ project, summary, total, floorArea, balconyArea }, ref) {
    const b = project.building;
    const px = 42;
    const cellW = b.w * px + 60;
    const cellH = b.d * px + 90;
    const cols = 2;
    const rows = Math.ceil((project.floors.length + 1) / cols);
    const W = cols * cellW + 40;
    const H = rows * cellH + 80;
    const siteArea = project.site.areaOverride ?? 0;
    return (
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}>
        <rect width={W} height={H} fill="#fff" />
        <text x={W / 2} y={40} textAnchor="middle" fontSize={24} fontWeight={700}>
          {project.name}　建物参考プラン（{b.structureLabel}）
        </text>
        {project.floors.map((f, i) => {
          const cx = 20 + (i % cols) * cellW;
          const cy = 70 + Math.floor(i / cols) * cellH;
          return (
            <g key={f.level}>
              <rect x={cx + 10} y={cy} width={260} height={26} rx={4} fill="#fff" stroke="#333" />
              <text x={cx + 20} y={cy + 18} fontSize={14} fontWeight={700}>
                {f.level}階　床面積 {round(floorArea(f), 2)}㎡{balconyArea(f) ? `（バルコニー ${round(balconyArea(f), 2)}㎡ 別）` : ""}
              </text>
              <NorthMark x={cx + cellW - 40} y={cy + 24} deg={project.site.northDeg + project.building.rotDeg} />
              <FloorSvg floor={f} project={project} ox={cx + 30} oy={cy + 50} px={px} compact />
            </g>
          );
        })}
        {(() => {
          const i = project.floors.length;
          const cx = 20 + (i % cols) * cellW;
          const cy = 70 + Math.floor(i / cols) * cellH;
          const lines: [string, string][] = [
            ["間取り", summary],
            ["敷地面積", siteArea ? `${round(siteArea, 2)}㎡（${round(siteArea / TSUBO_M2, 2)}坪）` : "－"],
            ["建築面積", `${round(b.w * b.d, 2)}㎡`],
            ...project.floors.map((f) => [`${f.level}階`, `${round(floorArea(f), 2)}㎡${balconyArea(f) ? `（＋バルコニー ${round(balconyArea(f), 2)}㎡）` : ""}`] as [string, string]),
            ["延床面積", `${round(total, 2)}㎡（${round(total / TSUBO_M2, 2)}坪）`],
          ];
          return (
            <g>
              <rect x={cx + 10} y={cy + 10} width={cellW - 30} height={lines.length * 26 + 80} rx={10} fill="#fbf7ef" stroke="#333" />
              <text x={cx + 30} y={cy + 40} fontSize={15} fontWeight={700}>建物参考プラン（{b.structureLabel}）</text>
              {lines.map(([k, v], j) => (
                <g key={k + j}>
                  <line x1={cx + 30} y1={cy + 56 + j * 26 + 20} x2={cx + cellW - 40} y2={cy + 56 + j * 26 + 20} stroke="#ccc" strokeDasharray="3 3" />
                  <text x={cx + 30} y={cy + 56 + j * 26 + 12} fontSize={12} fill="#555">{k}</text>
                  <text x={cx + 150} y={cy + 56 + j * 26 + 12} fontSize={12} fontWeight={600}>{v}</text>
                </g>
              ))}
              <text x={cx + 30} y={cy + 56 + lines.length * 26 + 40} fontSize={10} fill="#666">
                ※参考プランです。面積は壁芯計算の概算で、建築には別途設計・建築確認が必要です。
              </text>
            </g>
          );
        })()}
      </svg>
    );
  }
);
