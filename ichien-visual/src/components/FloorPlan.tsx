"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, Room, RoomType, Floor, StairDir, StairKind, TurnSide, Fixture, FixtureKind } from "@/lib/types";
import { ROOM_FILL, ROOM_LABEL, ROOM_DEFAULT_SIZE, FIXTURE_LABEL, FIXTURE_DEFAULT_WIDTH, TATAMI_M2, TSUBO_M2, HALF, MODULE } from "@/lib/types";
import { round } from "@/lib/geometry";
import { downloadSvgAsPng, uid } from "@/lib/store";
import { clearances } from "@/lib/grid";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

const PX = 60; // px per m
const snap = (v: number) => Math.round(v / HALF) * HALF;

const FIXTURE_KINDS: FixtureKind[] = ["door_single", "sliding_single", "sliding_double", "folding", "door_entrance", "door_parent_child", "window", "window_terrace", "window_small", "opening"];
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
  /** 一覧からドラッグ中の部屋 */
  const [placing, setPlacing] = useState<{ type: RoomType; w: number; d: number } | null>(null);
  const [placingFx, setPlacingFx] = useState<FixtureKind | null>(null);
  const [selFx, setSelFx] = useState<string | null>(null);
  const [dragFx, setDragFx] = useState<{ id: string; ox: number; oy: number; sx: number; sy: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const placingRef = useRef(placing);
  placingRef.current = placing;
  useEffect(() => {
    if (!placing && !placingFx) return;
    const up = () => setTimeout(() => { setPlacing(null); setPlacingFx(null); setGhost(null); }, 0);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [placing, placingFx]);

  const floor: Floor = project.floors.find((f) => f.level === level) ?? { level, rooms: [] };
  const setFloor = (u: (f: Floor) => Floor) =>
    setProject((p) => {
      const exists = p.floors.some((f) => f.level === level);
      const floors = exists ? p.floors.map((f) => (f.level === level ? u(f) : f)) : [...p.floors, u({ level, rooms: [] })];
      return { ...p, floors: floors.sort((a, b) => a.level - b.level) };
    });
  const updateRoom = (id: string, patch: Partial<Room>) => setFloor((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const fixtures: Fixture[] = floor.fixtures ?? [];
  const updateFx = (id: string, patch: Partial<Fixture>) => setFloor((f) => ({ ...f, fixtures: (f.fixtures ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const addFx = (kind: FixtureKind, at: { x: number; y: number }) => {
    const width = FIXTURE_DEFAULT_WIDTH[kind];
    const fx: Fixture = { id: uid(), kind, x: Math.max(0, Math.min(building.w, snap(at.x))), y: Math.max(0, Math.min(building.d, snap(at.y))), along: "h", width, hinge: "start", swing: "plus" };
    setFloor((f) => ({ ...f, fixtures: [...(f.fixtures ?? []), fx] }));
    setSelFx(fx.id);
    setSel(null);
  };

  const flip = !!project.grid?.flip;
  const cl = clearances(project.site, project.grid, building.w, building.d);
  const M = 90; // 境界までの寸法を書く余白
  const W = building.w * PX + M * 2;
  const H = building.d * PX + M * 2;
  const ox = M;
  const oy = M;
  const toPx = (x: number, y: number) => ({ x: ox + x * PX, y: oy + (building.d - y) * PX });
  void toPx;

  const localOf = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const x = (pt.x - ox) / PX;
    const y = building.d - (pt.y - oy) / PX;
    return flip ? { x: building.w - x, y: building.d - y } : { x, y };
  };

  const clampPos = (x: number, y: number, w: number, d: number) => ({
    x: Math.max(0, Math.min(building.w - w, snap(x))),
    y: Math.max(0, Math.min(building.d - d, snap(y))),
  });

  const onMove = (e: React.PointerEvent) => {
    if (placingFx) {
      const p = localOf(e);
      setGhost({ x: snap(p.x), y: snap(p.y) });
      return;
    }
    if (dragFx) {
      const p = localOf(e);
      updateFx(dragFx.id, { x: Math.max(0, Math.min(building.w, snap(dragFx.ox + p.x - dragFx.sx))), y: Math.max(0, Math.min(building.d, snap(dragFx.oy + p.y - dragFx.sy))) });
      return;
    }
    if (placing) {
      const p = localOf(e);
      setGhost(clampPos(p.x - placing.w / 2, p.y - placing.d / 2, placing.w, placing.d));
      return;
    }
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

  const addRoom = (type: RoomType, at?: { x: number; y: number }) => {
    const [dw, dd] = ROOM_DEFAULT_SIZE[type];
    const w = Math.min(dw, building.w);
    const d = Math.min(dd, building.d);
    const pos = at ? clampPos(at.x, at.y, w, d) : { x: 0, y: 0 };
    const r: Room = { id: uid(), name: ROOM_LABEL[type], type, x: round(pos.x, 3), y: round(pos.y, 3), w, d, ...(type === "stairs" ? { dir: "up" as StairDir } : {}) };
    setFloor((f) => ({ ...f, rooms: [...f.rooms, r] }));
    setSel(r.id);
  };

  const rotateRoom = (id: string) => {
    const r = floor.rooms.find((x) => x.id === id);
    if (!r) return;
    const w = Math.min(r.d, building.w);
    const d = Math.min(r.w, building.d);
    const pos = clampPos(r.x, r.y, w, d);
    const turn: Record<StairDir, StairDir> = { up: "right", right: "down", down: "left", left: "up" };
    updateRoom(id, { w, d, x: pos.x, y: pos.y, ...(r.dir ? { dir: turn[r.dir] } : {}) });
  };

  const copyStairsToAllFloors = (r: Room) => {
    setProject((p) => {
      const floors = Array.from({ length: p.building.floors }, (_, i) => i + 1).map((lv) => {
        const f = p.floors.find((x) => x.level === lv) ?? { level: lv, rooms: [] };
        const others = f.rooms.filter((x) => x.type !== "stairs");
        return { ...f, rooms: [...others, { ...r, id: lv === level ? r.id : uid() }] };
      });
      return { ...p, floors };
    });
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
      setProject((p) => ({ ...p, floors: (json.floors as Floor[]).map((f) => ({ ...f, fixtures: p.floors.find((x) => x.level === f.level)?.fixtures ?? [] })) }));
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
          <p className="text-[11px] text-slate-500">部屋を図の上へ<b>ドラッグして落とす</b>と置けます（クリックでも追加）。</p>
          <div className="flex flex-wrap gap-1">
            {ROOM_TYPES.map((t) => (
              <button
                key={t}
                className="touch-none cursor-grab rounded border border-slate-300 px-1.5 py-0.5 text-[11px] shadow-sm hover:bg-slate-50 active:cursor-grabbing"
                style={{ background: ROOM_FILL[t] }}
                onPointerDown={(e) => { e.preventDefault(); const [w, d] = ROOM_DEFAULT_SIZE[t]; setPlacing({ type: t, w: Math.min(w, building.w), d: Math.min(d, building.d) }); }}
                onClick={() => { if (!ghost) addRoom(t); }}
              >
                ＋{ROOM_LABEL[t]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">建具も同じくドラッグで壁の上へ。置いた後に向き・吊元・開く側を変えられます。</p>
          <div className="flex flex-wrap gap-1">
            {FIXTURE_KINDS.map((k) => (
              <button
                key={k}
                className="touch-none cursor-grab rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] shadow-sm hover:bg-slate-50"
                onPointerDown={(e) => { e.preventDefault(); setPlacingFx(k); }}
                onClick={() => { if (!ghost) addFx(k, { x: 0, y: 0 }); }}
                title={`標準幅 ${Math.round(FIXTURE_DEFAULT_WIDTH[k] * 1000)}mm`}
              >
                ＋{FIXTURE_LABEL[k]}
              </button>
            ))}
          </div>
          {fixtures.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-100 p-1">
              {fixtures.map((fx) => (
                <div key={fx.id} className={`rounded border p-1 text-[11px] ${selFx === fx.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`} onClick={() => { setSelFx(fx.id); setSel(null); }}>
                  <div className="flex flex-wrap items-center gap-1">
                    <select className="field w-auto px-1 py-0" value={fx.kind} onChange={(e) => updateFx(fx.id, { kind: e.target.value as FixtureKind, width: FIXTURE_DEFAULT_WIDTH[e.target.value as FixtureKind] })}>
                      {FIXTURE_KINDS.map((k) => <option key={k} value={k}>{FIXTURE_LABEL[k]}</option>)}
                    </select>
                    <button className="rounded border border-slate-200 px-1 hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); updateFx(fx.id, { along: fx.along === "h" ? "v" : "h" }); }}>{fx.along === "h" ? "横壁" : "縦壁"}</button>
                    {(fx.kind === "door_single" || fx.kind === "door_entrance" || fx.kind === "door_parent_child") && (
                      <>
                        <button className="rounded border border-slate-200 px-1 hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); updateFx(fx.id, { hinge: fx.hinge === "end" ? "start" : "end" }); }}>吊元{fx.along === "h" ? (fx.hinge === "end" ? "右" : "左") : (fx.hinge === "end" ? "上" : "下")}</button>
                        <button className="rounded border border-slate-200 px-1 hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); updateFx(fx.id, { swing: fx.swing === "minus" ? "plus" : "minus" }); }}>開き{fx.along === "h" ? (fx.swing === "minus" ? "↓" : "↑") : (fx.swing === "minus" ? "←" : "→")}</button>
                      </>
                    )}
                    <label className="flex items-center gap-0.5"><span className="text-slate-400">幅</span><input type="number" step="0.01" className="field w-16 px-1 py-0" value={fx.width} onChange={(e) => updateFx(fx.id, { width: Number(e.target.value) })} /></label>
                    <button className="px-1 text-red-500" onClick={(e) => { e.stopPropagation(); setFloor((f) => ({ ...f, fixtures: (f.fixtures ?? []).filter((x) => x.id !== fx.id) })); }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                  <span>{round(r.w * r.d, 2)} m² ＝ {round((r.w * r.d) / TATAMI_M2, 1)} 帖</span>
                  <button className="rounded border border-slate-200 px-1 hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); rotateRoom(r.id); }}>↻ 90°回す</button>
                  {r.type === "stairs" && (
                    <>
                      <select className="field w-auto px-1 py-0" value={r.stairKind ?? "straight"} onChange={(e) => { const k = e.target.value as StairKind; const size = k === "straight" ? { w: 0.91, d: 2.73 } : { w: 1.82, d: 1.82 }; updateRoom(r.id, { stairKind: k, ...size, turn: r.turn ?? "left" }); }}>
                        <option value="straight">直階段</option>
                        <option value="u_turn">回り階段（1820×1820）</option>
                        <option value="l_turn">かね折れ階段</option>
                      </select>
                      {(r.stairKind === "u_turn" || r.stairKind === "l_turn") && (
                        <select className="field w-auto px-1 py-0" value={r.turn ?? "left"} onChange={(e) => updateRoom(r.id, { turn: e.target.value as TurnSide })}>
                          <option value="left">左に曲がる</option>
                          <option value="right">右に曲がる</option>
                        </select>
                      )}
                      <span>上り始めの向き</span>
                      <select className="field w-auto px-1 py-0" value={r.dir ?? "up"} onChange={(e) => updateRoom(r.id, { dir: e.target.value as StairDir })}>
                        <option value="up">奥へ（上）</option>
                        <option value="down">底辺側へ（下）</option>
                        <option value="left">左へ</option>
                        <option value="right">右へ</option>
                      </select>
                      <button className="rounded border border-slate-200 px-1 hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); copyStairsToAllFloors(r); }}>全階に同じ階段</button>
                    </>
                  )}
                </div>
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
            onPointerUp={(e) => {
              setDrag(null);
              setDragFx(null);
              if (placingFx) {
                const p = localOf(e);
                addFx(placingFx, { x: p.x, y: p.y });
                setPlacingFx(null);
                setGhost(null);
              } else if (placing) {
                const p = localOf(e);
                addRoom(placing.type, { x: p.x - placing.w / 2, y: p.y - placing.d / 2 });
                setPlacing(null);
                setGhost(null);
              }
            }}
            onPointerLeave={() => { setDrag(null); setDragFx(null); setGhost(null); }}
            onPointerDown={(e) => { if (e.target === svgRef.current) { setSel(null); setSelFx(null); } }}
          >
            <rect width={W} height={H} fill="#fff" />
            <FloorSvg floor={floor} project={project} ox={ox} oy={oy} px={PX} sel={sel} onSelect={setSel} flip={flip} level={level} onStartDrag={(r, mode, e) => { if (mode === "resize" && flip) return; const p = localOf(e); setDrag({ id: r.id, mode, ox: r.x, oy: r.y, ow: r.w, od: r.d, sx: p.x, sy: p.y }); }} />
            <FixturesSvg fixtures={fixtures} project={project} ox={ox} oy={oy} px={PX} flip={flip} sel={selFx} onSelect={(id) => { setSelFx(id); setSel(null); }} onStartDrag={(fx, e) => { const p = localOf(e); setDragFx({ id: fx.id, ox: fx.x, oy: fx.y, sx: p.x, sy: p.y }); }} />
            {level === 1 && <BoundaryDims cl={cl} ox={ox} oy={oy} px={PX} w={building.w} d={building.d} flip={flip} roadSide="bottom" />}
            {placingFx && ghost && (() => {
              const gx = flip ? ox + (building.w - ghost.x) * PX : ox + ghost.x * PX;
              const gy = flip ? oy + ghost.y * PX : oy + (building.d - ghost.y) * PX;
              return <circle cx={gx} cy={gy} r={7} fill="#2f6fed" fillOpacity={0.5} style={{ pointerEvents: "none" }} />;
            })()}
            {placing && ghost && (() => {
              const gx = flip ? ox + (building.w - ghost.x - placing.w) * PX : ox + ghost.x * PX;
              const gy = flip ? oy + ghost.y * PX : oy + (building.d - ghost.y - placing.d) * PX;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={gx} y={gy} width={placing.w * PX} height={placing.d * PX} fill={ROOM_FILL[placing.type]} fillOpacity={0.7} stroke="#2f6fed" strokeWidth={2} strokeDasharray="6 3" />
                  <text x={gx + (placing.w * PX) / 2} y={gy + (placing.d * PX) / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1d479c">{ROOM_LABEL[placing.type]}</text>
                </g>
              );
            })()}
            <text x={ox} y={oy - 62} fontSize={16} fontWeight={700} fill="#222">
              {level}階　床面積 {round(floorArea(floor), 2)}㎡{balconyArea(floor) ? `（バルコニー ${round(balconyArea(floor), 2)}㎡ 別）` : ""}
            </text>
            <NorthMark x={W - 30} y={oy - 10} deg={project.site.northDeg + project.building.rotDeg + (project.grid?.flip ? 180 : 0)} />
          </svg>
        </div>

        {/* 書き出し用：全階まとめ（非表示） */}
        <div className="hidden">
          <AllFloorsSvg ref={allRef} project={project} summary={summary} total={total} floorArea={floorArea} balconyArea={balconyArea} />
        </div>

        {selected && (
          <div className="text-xs text-slate-500">
            選択中: <b>{selected.name}</b>　ドラッグで移動、右下の■で大きさ変更。数値と回転・階段の向きは左の表で。
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
export function FloorSvg({ floor, project, ox, oy, px, sel, onSelect, onStartDrag, compact, flip, level }: {
  floor: Floor;
  project: Project;
  ox: number;
  oy: number;
  px: number;
  sel?: string | null;
  onSelect?: (id: string) => void;
  onStartDrag?: (r: Room, mode: "move" | "resize", e: React.PointerEvent) => void;
  compact?: boolean;
  flip?: boolean;
  level?: number;
}) {
  const b = project.building;
  const lv = level ?? floor.level;
  const topFloor = b.floors;
  const toPx = (x: number, y: number) => (flip ? { x: ox + (b.w - x) * px, y: oy + y * px } : { x: ox + x * px, y: oy + (b.d - y) * px });
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
        const p0 = toPx(r.x, r.y + r.d);
        const p1 = toPx(r.x + r.w, r.y);
        const p = { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y) };
        const w = r.w * px;
        const h = r.d * px;
        const isSel = sel === r.id;
        const tatami = (r.w * r.d) / TATAMI_M2;
        const showTatami = ["ldk", "living", "bedroom", "japanese", "study"].includes(r.type);
        return (
          <g key={r.id} onPointerDown={(e) => { e.stopPropagation(); onSelect?.(r.id); onStartDrag?.(r, "move", e); }} className={onStartDrag ? "cursor-move" : ""}>
            <rect x={p.x} y={p.y} width={w} height={h} fill={ROOM_FILL[r.type]} stroke={isSel ? "#2f6fed" : "#1b1b1b"} strokeWidth={isSel ? 3 : 2.5} />
            {r.type === "stairs" && <StairLines x={p.x} y={p.y} w={w} h={h} px={px} dir={r.dir ?? "up"} flip={!!flip} showUp={lv < topFloor} showDown={lv > 1} compact={compact} kind={r.stairKind ?? "straight"} turn={r.turn ?? "left"} />}
            {r.type === "stairs" ? (
              <text x={p.x + 4} y={p.y + (compact ? 9 : 12)} fontSize={compact ? 8 : 10} fontWeight={700} fill="#222" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={2} paintOrder="stroke">
                {r.name}
              </text>
            ) : (
              <text x={p.x + w / 2} y={p.y + h / 2 + (showTatami ? -2 : 4)} textAnchor="middle" fontSize={Math.min(compact ? 12 : 15, Math.max(8, w / 5))} fontWeight={700} fill="#222" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {r.name}
              </text>
            )}
            {showTatami && (
              <text x={p.x + w / 2} y={p.y + h / 2 + (compact ? 12 : 16)} textAnchor="middle" fontSize={compact ? 10 : 13} fill="#333" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {round(tatami, 1).toFixed(1)}帖
              </text>
            )}
            {isSel && onStartDrag && !flip && (
              <rect x={p.x + w - 8} y={p.y + h - 8} width={10} height={10} fill="#2f6fed" className="cursor-nwse-resize" onPointerDown={(e) => { e.stopPropagation(); onStartDrag(r, "resize", e); }} />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** 1階: 建物の各辺から境界線までの距離（mm） */
export function BoundaryDims({ cl, ox, oy, px, w, d, flip, compact }: { cl: { bottom: number | null; top: number | null; left: number | null; right: number | null }; ox: number; oy: number; px: number; w: number; d: number; flip: boolean; roadSide: "bottom"; compact?: boolean }) {
  // 表示上の各辺に対応する距離（反転時は上下左右が入れ替わる）
  const top = flip ? cl.bottom : cl.top;
  const bottom = flip ? cl.top : cl.bottom;
  const left = flip ? cl.right : cl.left;
  const right = flip ? cl.left : cl.right;
  const roadOnTop = flip;
  const fs = compact ? 9 : 11;
  const L = compact ? 22 : 34;
  const mm = (m: number | null) => (m === null ? "－" : `${Math.round(m * 1000).toLocaleString()}`);
  const cx = ox + (w * px) / 2;
  const cy = oy + (d * px) / 2;
  const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c0392b" strokeWidth={1} markerStart="url(#bdS)" markerEnd="url(#bdE)" />
  );
  return (
    <g fontSize={fs} fill="#c0392b" fontWeight={700}>
      <defs>
        <marker id="bdE" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#c0392b" /></marker>
        <marker id="bdS" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6 z" fill="#c0392b" /></marker>
      </defs>
      {/* 上 */}
      <Arrow x1={cx} y1={oy - 2} x2={cx} y2={oy - L} />
      <line x1={ox - 10} y1={oy - L} x2={ox + w * px + 10} y2={oy - L} stroke="#c0392b" strokeWidth={0.8} strokeDasharray="5 3" />
      <text x={cx + 6} y={oy - L / 2 + 4}>{roadOnTop ? "道路境界線まで" : "隣地境界線まで"} {mm(top)}</text>
      {/* 下 */}
      <Arrow x1={cx} y1={oy + d * px + 2} x2={cx} y2={oy + d * px + L} />
      <line x1={ox - 10} y1={oy + d * px + L} x2={ox + w * px + 10} y2={oy + d * px + L} stroke="#c0392b" strokeWidth={0.8} strokeDasharray="5 3" />
      <text x={cx + 6} y={oy + d * px + L / 2 + 4}>{roadOnTop ? "隣地境界線まで" : "道路境界線まで"} {mm(bottom)}</text>
      {/* 左 */}
      <Arrow x1={ox - 2} y1={cy} x2={ox - L} y2={cy} />
      <line x1={ox - L} y1={oy - 10} x2={ox - L} y2={oy + d * px + 10} stroke="#c0392b" strokeWidth={0.8} strokeDasharray="5 3" />
      <text x={ox - L / 2} y={cy - 8} textAnchor="middle" transform={`rotate(-90 ${ox - L / 2} ${cy - 8})`}>隣地境界線まで {mm(left)}</text>
      {/* 右 */}
      <Arrow x1={ox + w * px + 2} y1={cy} x2={ox + w * px + L} y2={cy} />
      <line x1={ox + w * px + L} y1={oy - 10} x2={ox + w * px + L} y2={oy + d * px + 10} stroke="#c0392b" strokeWidth={0.8} strokeDasharray="5 3" />
      <text x={ox + w * px + L / 2} y={cy - 8} textAnchor="middle" transform={`rotate(90 ${ox + w * px + L / 2} ${cy - 8})`}>隣地境界線まで {mm(right)}</text>
    </g>
  );
}

/** 階段: 直階段 / 回り階段（1坪・折り返し） / かね折れ。段の線と UP/DN の矢印 */
function StairLines({ x, y, w, h, px, dir, flip, showUp, showDown, compact, kind, turn }: { x: number; y: number; w: number; h: number; px: number; dir: StairDir; flip: boolean; showUp: boolean; showDown: boolean; compact?: boolean; kind: StairKind; turn: TurnSide }) {
  // 建物基準の向き → 画面上の向き（反転時は上下左右が逆）。反転時は左右の曲がりも逆
  const screenDir: StairDir = flip ? ({ up: "down", down: "up", left: "right", right: "left" } as const)[dir] : dir;
  const screenTurn: TurnSide = flip ? (turn === "left" ? "right" : "left") : turn;
  const fs = compact ? 7 : 9;
  // 画面座標系で「進行方向 f」と「左方向 l」の単位ベクトル
  const F = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[screenDir];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pitch = 0.23 * px;
  const label = (tx: number, ty: number, text: string) => (
    <text x={tx} y={ty + 3} textAnchor="middle" fontSize={fs} fontWeight={700} fill="#c0392b" stroke="#fff" strokeWidth={2} paintOrder="stroke">{text}</text>
  );
  const head = (x2: number, y2: number, vx: number, vy: number) => {
    const ang = (Math.atan2(vy, vx) * 180) / Math.PI;
    return <polygon points={`${x2},${y2} ${x2 - 7},${y2 - 3.5} ${x2 - 7},${y2 + 3.5}`} fill="#c0392b" transform={`rotate(${ang} ${x2} ${y2})`} />;
  };
  const stepsBetween = (ax: number, ay: number, bx: number, by: number, halfLen: number) => {
    // a→b の線分上に、進行方向と直交する段の線を等間隔で引く
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.floor(len / pitch));
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const nx = -uy, ny = ux;
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      const mx = ax + (bx - ax) * t, my = ay + (by - ay) * t;
      return <line key={i} x1={mx - nx * halfLen} y1={my - ny * halfLen} x2={mx + nx * halfLen} y2={my + ny * halfLen} stroke="#666" strokeWidth={0.8} />;
    });
  };

  if (kind === "straight") {
    const vertical = screenDir === "up" || screenDir === "down";
    const len = (vertical ? h : w) * 0.7;
    const off = (vertical ? w : h) * 0.22;
    const arrow = (sign: 1 | -1, text: string, offset: number) => {
      const ax = cx + (vertical ? offset : 0), ay = cy + (vertical ? 0 : offset);
      const x1 = ax - (F[0] * sign * len) / 2, y1 = ay - (F[1] * sign * len) / 2;
      const x2 = ax + (F[0] * sign * len) / 2, y2 = ay + (F[1] * sign * len) / 2;
      return (
        <g key={text}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c0392b" strokeWidth={1.2} />
          {head(x2, y2, x2 - x1, y2 - y1)}
          {label(x1 - F[0] * sign * 8, y1 - F[1] * sign * 8, text)}
        </g>
      );
    };
    return (
      <g>
        {vertical ? stepsBetween(cx, y, cx, y + h, w / 2) : stepsBetween(x, cy, x + w, cy, h / 2)}
        {showUp && arrow(1, "UP", showDown ? -off : 0)}
        {showDown && arrow(-1, "DN", showUp ? off : 0)}
      </g>
    );
  }

  // ===== 回り / かね折れ =====
  // ローカル座標: 中心を原点、第1直進部は「上」へ、曲がりは「左」。dir と turn は transform で与える
  const angle = { up: 0, right: 90, down: 180, left: 270 }[screenDir];
  const mirror = screenTurn === "left" ? 1 : -1;
  const LW = screenDir === "up" || screenDir === "down" ? w : h; // 進行方向に直交する幅
  const LH = screenDir === "up" || screenDir === "down" ? h : w; // 進行方向の長さ
  const col = LW / 2; // 1列の幅
  const Py = -LH / 2 + col; // 回り部分の内側の角（ピボット）の y
  const clipId = `stclip-${Math.round(x)}-${Math.round(y)}`;
  const upright = (tx: number, ty: number, text: string) => (
    <g transform={`translate(${tx} ${ty}) scale(${mirror} 1) rotate(${-angle})`}>{label(0, 0, text)}</g>
  );
  const items: React.ReactNode[] = [];
  // 第1直進部（右の列、下→上）
  items.push(...stepsBetween(col / 2, LH / 2, col / 2, Py, col / 2).map((el, i) => <g key={"a" + i}>{el}</g>));
  // 回り部分（ピボットを中心に扇形）
  const fanN = kind === "u_turn" ? 6 : 3;
  const a0 = 0; // 右向き
  const a1 = kind === "u_turn" ? -180 : -90; // 左向き / 上向き
  for (let i = 0; i <= fanN; i++) {
    const a = ((a0 + ((a1 - a0) * i) / fanN) * Math.PI) / 180;
    items.push(<line key={"f" + i} x1={0} y1={Py} x2={Math.cos(a) * LW * 1.5} y2={Py + Math.sin(a) * LW * 1.5} stroke="#666" strokeWidth={0.8} clipPath={`url(#${clipId})`} />);
  }
  // 第2直進部
  let endX = 0, endY = 0, endVx = 0, endVy = 0;
  if (kind === "u_turn") {
    items.push(...stepsBetween(-col / 2, Py, -col / 2, LH / 2, col / 2).map((el, i) => <g key={"b" + i}>{el}</g>));
    endX = -col / 2; endY = LH / 2 - 6; endVx = 0; endVy = 1;
  } else {
    // かね折れ: 上の段を左へ
    items.push(...stepsBetween(0, Py - col / 2, -LW / 2, Py - col / 2, col / 2).map((el, i) => <g key={"b" + i}>{el}</g>));
    endX = -LW / 2 + 6; endY = Py - col / 2; endVx = -1; endVy = 0;
  }
  const sx = col / 2, sy = LH / 2 - 6;
  const path = kind === "u_turn"
    ? `M ${sx} ${sy} L ${sx} ${Py} A ${col / 2} ${col / 2} 0 0 0 ${-col / 2} ${Py} L ${endX} ${endY}`
    : `M ${sx} ${sy} L ${sx} ${Py} A ${col / 2} ${col / 2} 0 0 0 ${0} ${Py - col / 2} L ${endX} ${endY}`;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angle}) scale(${mirror} 1)`}>
      <defs>
        <clipPath id={clipId}><rect x={-LW / 2} y={-LH / 2} width={LW} height={LH} /></clipPath>
      </defs>
      <line x1={0} y1={Py} x2={0} y2={LH / 2} stroke="#444" strokeWidth={1} />
      {items}
      {(showUp || showDown) && <path d={path} fill="none" stroke="#c0392b" strokeWidth={1.2} />}
      {showUp && head(endX, endY, endVx, endVy)}
      {showUp && upright(sx, sy + 8, "UP")}
      {showDown && !showUp && head(sx, sy, 0, 1)}
      {showDown && upright(endX + endVx * 8, endY + (kind === "u_turn" ? 8 : endVy * 8), "DN")}
    </g>
  );
}

/** 建具の描画。壁の上に開口を白で抜き、種類ごとの記号を描く */
export function FixturesSvg({ fixtures, project, ox, oy, px, flip, sel, onSelect, onStartDrag, compact }: { fixtures: Fixture[]; project: Project; ox: number; oy: number; px: number; flip: boolean; sel?: string | null; onSelect?: (id: string) => void; onStartDrag?: (fx: Fixture, e: React.PointerEvent) => void; compact?: boolean }) {
  const b = project.building;
  const toPx = (x: number, y: number) => (flip ? { x: ox + (b.w - x) * px, y: oy + y * px } : { x: ox + x * px, y: oy + (b.d - y) * px });
  const wallT = compact ? 5 : 8;
  return (
    <g>
      {fixtures.map((fx) => {
        const isSel = sel === fx.id;
        const p0 = toPx(fx.x, fx.y);
        // 壁に沿った単位ベクトル（画面）と法線（plus 側 = 建物座標で +y / +x）
        const alongV = fx.along === "h" ? (flip ? [-1, 0] : [1, 0]) : (flip ? [0, 1] : [0, -1]);
        const normV = fx.along === "h" ? (flip ? [0, 1] : [0, -1]) : (flip ? [-1, 0] : [1, 0]);
        const W = fx.width * px;
        const p1 = { x: p0.x + alongV[0] * W, y: p0.y + alongV[1] * W };
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const rot = (Math.atan2(alongV[1], alongV[0]) * 180) / Math.PI;
        const isDoor = fx.kind === "door_single" || fx.kind === "door_entrance" || fx.kind === "door_parent_child";
        const sw = fx.swing === "minus" ? -1 : 1;
        // グループ内の「上」（local -y）は、壁に沿った向きの左手側。plus 側がそれと一致するかで符号を決める
        const leftV = [alongV[1], -alongV[0]];
        const plusIsUp = leftV[0] * normV[0] + leftV[1] * normV[1] > 0;
        const ny = plusIsUp ? -sw : sw; // 開く側（local）: -1 = 上, +1 = 下
        const hingeAtEnd = fx.hinge === "end";
        const children: React.ReactNode[] = [];
        // 開口（壁を白で抜く）
        children.push(<rect key="gap" x={-W / 2} y={-wallT / 2} width={W} height={wallT} fill="#fff" />);
        if (isDoor) {
          const leafW = fx.kind === "door_parent_child" ? W * 0.66 : W;
          const hx = hingeAtEnd ? W / 2 : -W / 2; // 吊元
          const dirX = hingeAtEnd ? -1 : 1; // 開口の方向
          // 扉の線（壁に直交して開いた状態）と1/4円
          children.push(<line key="leaf" x1={hx} y1={0} x2={hx} y2={ny * leafW} stroke="#222" strokeWidth={1.5} />);
          const ex = hx + dirX * leafW, ey = 0;
          const sweep = (dirX * ny) > 0 ? 0 : 1;
          children.push(<path key="arc" d={`M ${hx} ${ny * leafW} A ${leafW} ${leafW} 0 0 ${sweep} ${ex} ${ey}`} fill="none" stroke="#555" strokeWidth={0.8} strokeDasharray="3 2" />);
          if (fx.kind === "door_parent_child") {
            const cx2 = hingeAtEnd ? -W / 2 : W / 2;
            children.push(<line key="child" x1={cx2} y1={0} x2={cx2} y2={ny * (W - leafW)} stroke="#222" strokeWidth={1.2} />);
          }
        } else if (fx.kind === "sliding_single") {
          children.push(<line key="rail" x1={-W / 2} y1={0} x2={W / 2} y2={0} stroke="#999" strokeWidth={0.6} />);
          children.push(<line key="panel" x1={-W / 2} y1={-wallT / 4} x2={0} y2={-wallT / 4} stroke="#222" strokeWidth={2} />);
          children.push(<line key="panel2" x1={0} y1={wallT / 4} x2={W / 2} y2={wallT / 4} stroke="#222" strokeWidth={2} />);
          children.push(<line key="ar" x1={-W * 0.1} y1={-wallT} x2={W * 0.3} y2={-wallT} stroke="#c0392b" strokeWidth={0.8} markerEnd="url(#fxArrow)" />);
        } else if (fx.kind === "sliding_double") {
          children.push(<line key="rail" x1={-W / 2} y1={0} x2={W / 2} y2={0} stroke="#999" strokeWidth={0.6} />);
          children.push(<line key="p1" x1={-W / 2} y1={-wallT / 4} x2={W * 0.05} y2={-wallT / 4} stroke="#222" strokeWidth={2} />);
          children.push(<line key="p2" x1={-W * 0.05} y1={wallT / 4} x2={W / 2} y2={wallT / 4} stroke="#222" strokeWidth={2} />);
        } else if (fx.kind === "folding") {
          const n = 4;
          const pts = Array.from({ length: n + 1 }, (_, i) => `${-W / 2 + (W * i) / n},${i % 2 === 0 ? 0 : ny * W * 0.12}`).join(" ");
          children.push(<polyline key="fold" points={pts} fill="none" stroke="#222" strokeWidth={1.5} />);
        } else if (fx.kind === "window" || fx.kind === "window_terrace" || fx.kind === "window_small") {
          children.push(<line key="g1" x1={-W / 2} y1={-wallT / 5} x2={W / 2} y2={-wallT / 5} stroke="#3a6ea5" strokeWidth={1.2} />);
          children.push(<line key="g2" x1={-W / 2} y1={wallT / 5} x2={W / 2} y2={wallT / 5} stroke="#3a6ea5" strokeWidth={1.2} />);
          children.push(<line key="e1" x1={-W / 2} y1={-wallT / 2} x2={-W / 2} y2={wallT / 2} stroke="#222" strokeWidth={1.5} />);
          children.push(<line key="e2" x1={W / 2} y1={-wallT / 2} x2={W / 2} y2={wallT / 2} stroke="#222" strokeWidth={1.5} />);
          if (fx.kind === "window_terrace") children.push(<line key="mid" x1={0} y1={-wallT / 2} x2={0} y2={wallT / 2} stroke="#222" strokeWidth={1} />);
        } else {
          children.push(<line key="o1" x1={-W / 2} y1={-wallT / 2} x2={-W / 2} y2={wallT / 2} stroke="#222" strokeWidth={1.5} />);
          children.push(<line key="o2" x1={W / 2} y1={-wallT / 2} x2={W / 2} y2={wallT / 2} stroke="#222" strokeWidth={1.5} />);
        }
        return (
          <g key={fx.id} transform={`translate(${mid.x} ${mid.y}) rotate(${rot})`} onPointerDown={(e) => { e.stopPropagation(); onSelect?.(fx.id); onStartDrag?.(fx, e); }} className={onStartDrag ? "cursor-move" : ""}>
            <defs>
              <marker id="fxArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#c0392b" /></marker>
            </defs>
            <rect x={-W / 2 - 4} y={-wallT * 2} width={W + 8} height={wallT * 4} fill="transparent" />
            {children}
            {isSel && <rect x={-W / 2 - 4} y={-wallT * 2} width={W + 8} height={wallT * 4} fill="none" stroke="#2f6fed" strokeWidth={1.5} strokeDasharray="4 2" />}
            {!compact && <text x={0} y={ny < 0 ? wallT * 2.6 : -wallT * 1.8} textAnchor="middle" fontSize={8} fill="#555" transform={Math.abs(rot) > 90 ? `rotate(180 0 ${ny < 0 ? wallT * 2.6 - 3 : -wallT * 1.8 - 3})` : undefined}>{FIXTURE_LABEL[fx.kind]} {Math.round(fx.width * 1000)}</text>}
          </g>
        );
      })}
    </g>
  );
}

import { forwardRef } from "react";

export const AllFloorsSvg = forwardRef<SVGSVGElement, { project: Project; summary: string; total: number; floorArea: (f: Floor) => number; balconyArea: (f: Floor) => number }>(
  function AllFloorsSvg({ project, summary, total, floorArea, balconyArea }, ref) {
    const b = project.building;
    const px = 42;
    const cellW = b.w * px + 120;
    const cellH = b.d * px + 150;
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
              <NorthMark x={cx + cellW - 40} y={cy + 24} deg={project.site.northDeg + project.building.rotDeg + (project.grid?.flip ? 180 : 0)} />
              <FloorSvg floor={f} project={project} ox={cx + 60} oy={cy + 80} px={px} compact flip={!!project.grid?.flip} />
              <FixturesSvg fixtures={f.fixtures ?? []} project={project} ox={cx + 60} oy={cy + 80} px={px} flip={!!project.grid?.flip} compact />
              {f.level === 1 && <BoundaryDims cl={clearances(project.site, project.grid, b.w, b.d)} ox={cx + 60} oy={cy + 80} px={px} w={b.w} d={b.d} flip={!!project.grid?.flip} roadSide="bottom" compact />}
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
