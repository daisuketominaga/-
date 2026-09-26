"use client";

import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import type { Building, Project, Room, RoomType, Floor, StairDir, StairKind, TurnSide, Fixture, FixtureKind } from "@/lib/types";
import { ROOM_FILL, ROOM_LABEL, ROOM_DEFAULT_SIZE, FIXTURE_LABEL, FIXTURE_DEFAULT_WIDTH, TATAMI_M2, TSUBO_M2, HALF, MODULE } from "@/lib/types";
import { round, northScreenDeg, footprintArea, footprintPolygon, notchesOf, notchRect } from "@/lib/geometry";
import { downloadSvgAsPng, uid } from "@/lib/store";
import { siteInBuildingFrame, type SiteContext } from "@/lib/grid";
import FixtureSchedule from "./FixtureSchedule";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

const PX = 60; // px per m
const snap = (v: number) => round(Math.round(v / HALF) * HALF, 3);

type Wall = { x1: number; y1: number; x2: number; y2: number; along: "h" | "v"; outer: boolean };
const EXTERIOR_ONLY: FixtureKind[] = ["window", "window_terrace", "window_small", "door_entrance", "door_parent_child"];
const DOOR_KINDS: FixtureKind[] = ["door_single", "door_entrance", "door_parent_child"];
/** 標準幅の候補（m）。カタログ寸法と455刻みの一般的な幅 */
const WIDTH_CHOICES: Record<FixtureKind, number[]> = {
  door_single: [0.65, 0.735, 0.78, 0.83, 0.91],
  door_entrance: [0.87, 0.924, 0.98],
  door_parent_child: [1.24, 1.365],
  sliding_single: [1.365, 1.644, 1.82],
  sliding_double: [1.644, 1.82, 2.73],
  folding: [0.91, 1.365, 1.644, 1.82],
  window: [0.64, 1.235, 1.69, 2.55],
  window_terrace: [1.69, 2.55, 3.64],
  window_small: [0.405, 0.64, 0.78],
  opening: [0.91, 1.82, 2.73, 3.64],
};

/** 外壁と部屋の境界線を壁の候補として集める */
function wallSegments(b: Building, rooms: Room[]): Wall[] {
  // 外壁 = 外形（切り欠き後）の各辺
  const poly = footprintPolygon(b);
  const walls: Wall[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    if (Math.abs(a.y - c.y) < 1e-9) walls.push({ x1: Math.min(a.x, c.x), y1: a.y, x2: Math.max(a.x, c.x), y2: a.y, along: "h", outer: true });
    else walls.push({ x1: a.x, y1: Math.min(a.y, c.y), x2: a.x, y2: Math.max(a.y, c.y), along: "v", outer: true });
  }
  const eps = 1e-6;
  const onOuter = (e: Wall) => walls.some((w) => w.outer && w.along === e.along && (e.along === "h" ? Math.abs(w.y1 - e.y1) < eps && e.x1 >= w.x1 - eps && e.x2 <= w.x2 + eps : Math.abs(w.x1 - e.x1) < eps && e.y1 >= w.y1 - eps && e.y2 <= w.y2 + eps));
  for (const r of rooms) {
    if (r.type === "balcony") continue;
    const edges: Wall[] = [
      { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, along: "h", outer: false },
      { x1: r.x, y1: r.y + r.d, x2: r.x + r.w, y2: r.y + r.d, along: "h", outer: false },
      { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.d, along: "v", outer: false },
      { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.d, along: "v", outer: false },
    ];
    for (const e of edges) if (!onOuter(e)) walls.push(e);
  }
  return walls;
}

/** 点に最も近い壁へ吸着させ、建具が壁の中に収まる位置を返す */
function snapToWall(kind: FixtureKind, width: number, x: number, y: number, walls: Wall[], others: Fixture[] = [], selfId?: string): { x: number; y: number; along: "h" | "v" } | null {
  const cands = EXTERIOR_ONLY.includes(kind) ? walls.filter((w) => w.outer) : walls;
  const eps = 1e-6;
  // 同じ壁線の上にある他の建具と重ならないか
  const free = (w: Wall, start: number) => {
    const a0 = (w.along === "h" ? w.x1 : w.y1) + start;
    const a1 = a0 + width;
    for (const o of others) {
      if (o.id === selfId || o.along !== w.along) continue;
      const sameLine = w.along === "h" ? Math.abs(o.y - w.y1) < eps : Math.abs(o.x - w.x1) < eps;
      if (!sameLine) continue;
      const b0 = w.along === "h" ? o.x : o.y;
      const b1 = b0 + o.width;
      if (a0 < b1 - eps && b0 < a1 - eps) return false;
    }
    return true;
  };
  let best: { d: number; w: Wall; start: number } | null = null;
  for (const w of cands) {
    const len = w.along === "h" ? w.x2 - w.x1 : w.y2 - w.y1;
    if (len < width - 1e-6) continue;
    const t = w.along === "h" ? x - w.x1 : y - w.y1;
    const want = Math.max(0, Math.min(len - width, t - width / 2));
    // 455刻みの候補を、望む位置に近い順に試す
    const n = Math.floor((len - width) / HALF + 1e-6);
    const starts = Array.from({ length: n + 1 }, (_, i) => i * HALF);
    if (len - width - n * HALF > 1e-6) starts.push(len - width);
    starts.sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    const start = starts.find((st) => free(w, st));
    if (start === undefined) continue;
    const px = w.along === "h" ? w.x1 + start + width / 2 : w.x1;
    const py = w.along === "h" ? w.y1 : w.y1 + start + width / 2;
    const d = Math.hypot(px - x, py - y);
    if (!best || d < best.d) best = { d, w, start };
  }
  if (!best) return null;
  const { w, start } = best;
  return w.along === "h" ? { x: round(w.x1 + start, 3), y: round(w.y1, 3), along: "h" } : { x: round(w.x1, 3), y: round(w.y1 + start, 3), along: "v" };
}

/** 2つの部屋が重なっているか（辺が接しているだけは重なりとしない） */
function overlaps(a: Room, b: Room) {
  const eps = 1e-6;
  return a.x + a.w > b.x + eps && b.x + b.w > a.x + eps && a.y + a.d > b.y + eps && b.y + b.d > a.y + eps;
}

const FIXTURE_KINDS: FixtureKind[] = ["door_single", "sliding_single", "sliding_double", "folding", "door_entrance", "door_parent_child", "window", "window_terrace", "window_small", "opening"];
const ROOM_TYPES: RoomType[] = ["ldk", "living", "kitchen", "bedroom", "japanese", "study", "entrance", "hall", "toilet", "bath", "washroom", "closet", "storage", "stairs", "garage", "balcony", "other"];

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Sel = { kind: "room"; id: string } | { kind: "fx"; id: string } | null;
type Drag =
  | { kind: "room-move"; id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean }
  | { kind: "room-resize"; id: string; handle: Handle; ox: number; oy: number; ow: number; od: number; sx: number; sy: number }
  | { kind: "fx-move"; id: string; ox: number; oy: number; sx: number; sy: number }
  | null;

export default function FloorPlan({ project, setProject }: Props) {
  const { building } = project;
  const [level, setLevel] = useState(1);
  const [sel, setSel] = useState<Sel>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [showFxLabels, setShowFxLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const allRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** パレットからドラッグ中 */
  const [placing, setPlacing] = useState<{ type: RoomType; w: number; d: number } | null>(null);
  const [placingFx, setPlacingFx] = useState<FixtureKind | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
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
  const removeRoom = (id: string) => { setFloor((f) => ({ ...f, rooms: f.rooms.filter((x) => x.id !== id) })); setSel(null); };
  const fixtures: Fixture[] = floor.fixtures ?? [];
  const updateFx = (id: string, patch: Partial<Fixture>) => setFloor((f) => ({ ...f, fixtures: (f.fixtures ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const removeFx = (id: string) => { setFloor((f) => ({ ...f, fixtures: (f.fixtures ?? []).filter((x) => x.id !== id) })); setSel(null); };
  const walls = wallSegments(building, floor.rooms);

  const addFx = (kind: FixtureKind, at: { x: number; y: number }) => {
    const width = FIXTURE_DEFAULT_WIDTH[kind];
    const pos = snapToWall(kind, width, at.x, at.y, walls, fixtures);
    if (!pos) {
      setMsg("エラー: この建具が収まる空きのある壁がありません（窓・玄関ドアは外壁のみ）");
      return;
    }
    const fx: Fixture = { id: uid(), kind, ...pos, width, hinge: "start", swing: "plus" };
    setFloor((f) => ({ ...f, fixtures: [...(f.fixtures ?? []), fx] }));
    setSel({ kind: "fx", id: fx.id });
  };

  const flip = !!project.grid?.flip;
  const [showSite, setShowSite] = useState(true);
  const siteCtx = useMemo(() => siteInBuildingFrame(project.site, project.grid, project.site.fireproofException ? 0 : project.site.setback), [project.site, project.grid]);
  const pad = useMemo(() => sitePadding(siteCtx, building.w, building.d, showSite), [siteCtx, building.w, building.d, showSite]);
  const M = 90;
  const W = building.w * PX + M * 2 + (pad.l + pad.r) * PX;
  const H = building.d * PX + M * 2 + (pad.t + pad.b) * PX;
  const ox = M + (flip ? pad.r : pad.l) * PX;
  const oy = M + (flip ? pad.b : pad.t) * PX;

  const localOf = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const x = (pt.x - ox) / PX;
    const y = building.d - (pt.y - oy) / PX;
    return flip ? { x: building.w - x, y: building.d - y } : { x, y };
  };

  const clampPos = (x: number, y: number, w: number, d: number) => ({
    x: Math.max(0, Math.min(snap(building.w - w), snap(x))),
    y: Math.max(0, Math.min(snap(building.d - d), snap(y))),
  });

  const onMove = (e: React.PointerEvent) => {
    if (placingFx) {
      const p = localOf(e);
      const pos = snapToWall(placingFx, FIXTURE_DEFAULT_WIDTH[placingFx], p.x, p.y, walls, fixtures);
      setGhost(pos ? { x: pos.x + (pos.along === "h" ? FIXTURE_DEFAULT_WIDTH[placingFx] / 2 : 0), y: pos.y + (pos.along === "v" ? FIXTURE_DEFAULT_WIDTH[placingFx] / 2 : 0) } : { x: p.x, y: p.y });
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
    if (drag.kind === "fx-move") {
      const fx = fixtures.find((f) => f.id === drag.id);
      if (!fx) return;
      const cx = drag.ox + dx + (fx.along === "h" ? fx.width / 2 : 0);
      const cy = drag.oy + dy + (fx.along === "v" ? fx.width / 2 : 0);
      const pos = snapToWall(fx.kind, fx.width, cx, cy, walls, fixtures, fx.id);
      if (pos) updateFx(drag.id, pos);
      return;
    }
    if (drag.kind === "room-move") {
      const r = floor.rooms.find((x) => x.id === drag.id);
      if (!r) return;
      const pos = clampPos(drag.ox + dx, drag.oy + dy, r.w, r.d);
      if (pos.x !== r.x || pos.y !== r.y) {
        updateRoom(drag.id, pos);
        if (!drag.moved) setDrag({ ...drag, moved: true });
      }
      return;
    }
    if (drag.kind === "room-resize") {
      // 建物座標で、つまんだ辺だけを動かす（反対側の辺は固定）
      const h = drag.handle;
      let x0 = drag.ox, y0 = drag.oy, x1 = drag.ox + drag.ow, y1 = drag.oy + drag.od;
      if (h.includes("e")) x1 = Math.min(building.w, Math.max(x0 + HALF, snap(drag.ox + drag.ow + dx)));
      if (h.includes("w")) x0 = Math.max(0, Math.min(x1 - HALF, snap(drag.ox + dx)));
      if (h.includes("n")) y1 = Math.min(building.d, Math.max(y0 + HALF, snap(drag.oy + drag.od + dy)));
      if (h.includes("s")) y0 = Math.max(0, Math.min(y1 - HALF, snap(drag.oy + dy)));
      updateRoom(drag.id, { x: round(x0, 3), y: round(y0, 3), w: round(x1 - x0, 3), d: round(y1 - y0, 3) });
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
    const w = Math.min(dw, snap(building.w));
    const d = Math.min(dd, snap(building.d));
    const pos = at ? clampPos(at.x, at.y, w, d) : { x: 0, y: 0 };
    const r: Room = { id: uid(), name: ROOM_LABEL[type], type, x: pos.x, y: pos.y, w, d, ...(type === "stairs" ? { dir: "up" as StairDir, stairKind: "straight" as StairKind } : {}) };
    setFloor((f) => ({ ...f, rooms: [...f.rooms, r] }));
    setSel({ kind: "room", id: r.id });
  };

  const rotateRoom = (id: string) => {
    const r = floor.rooms.find((x) => x.id === id);
    if (!r) return;
    const w = Math.min(r.d, snap(building.w));
    const d = Math.min(r.w, snap(building.d));
    const pos = clampPos(r.x, r.y, w, d);
    const turn: Record<StairDir, StairDir> = { up: "right", right: "down", down: "left", left: "up" };
    updateRoom(id, { w, d, x: pos.x, y: pos.y, ...(r.dir ? { dir: turn[r.dir] } : {}) });
  };

  const resizeRoom = (r: Room, dw: number, dd: number) => {
    const w = Math.max(HALF, Math.min(snap(building.w - r.x), snap(r.w + dw)));
    const d = Math.max(HALF, Math.min(snap(building.d - r.y), snap(r.d + dd)));
    updateRoom(r.id, { w, d });
  };

  const nudgeRoom = (r: Room, dx: number, dy: number) => updateRoom(r.id, clampPos(r.x + dx, r.y + dy, r.w, r.d));
  const nudgeFx = (fx: Fixture, dx: number, dy: number) => {
    const cx = fx.x + dx + (fx.along === "h" ? fx.width / 2 : 0);
    const cy = fx.y + dy + (fx.along === "v" ? fx.width / 2 : 0);
    const pos = snapToWall(fx.kind, fx.width, cx, cy, walls, fixtures, fx.id);
    if (pos) updateFx(fx.id, pos);
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

  /** 建具が新しい間取りの壁の上に残っているか */
  const fixtureOnWall = (fx: Fixture, rooms: Room[]) => {
    const eps = 1e-6;
    return wallSegments(building, rooms).some((w) => {
      if (w.along !== fx.along) return false;
      if (w.along === "h") return Math.abs(w.y1 - fx.y) < eps && fx.x >= w.x1 - eps && fx.x + fx.width <= w.x2 + eps;
      return Math.abs(w.x1 - fx.x) < eps && fx.y >= w.y1 - eps && fx.y + fx.width <= w.y2 + eps;
    });
  };

  const runAi = async (mode: "edit" | "generate") => {
    setBusy(true);
    setMsg(null);
    try {
      // 「提案」では、依頼者が置いた玄関と階段は動かさない
      const fixed = mode === "generate" ? project.floors.flatMap((f) => f.rooms).filter((r) => r.type === "entrance" || r.type === "stairs").map((r) => r.id) : undefined;
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, instruction, project: { building: project.building, floors: project.floors, site: { areaOverride: siteArea, coverageRatio: project.site.coverageRatio, farRatio: project.site.farRatio } }, level, fixed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "失敗しました");
      // 固定した部屋は元のまま戻す。建具は新しい壁の上に残るものだけ残す
      setProject((p) => ({
        ...p,
        floors: (json.floors as Floor[]).map((f) => {
          const old = p.floors.find((x) => x.level === f.level);
          const keep = (old?.rooms ?? []).filter((r) => fixed?.includes(r.id));
          const rooms = [...f.rooms.filter((r) => !keep.some((k) => k.id === r.id)), ...keep];
          const fixtures = (old?.fixtures ?? []).filter((fx) => fixtureOnWall(fx, rooms));
          return { ...f, rooms, fixtures };
        }),
      }));
      setMsg(json.notes || "更新しました");
      setInstruction("");
    } catch (e) {
      setMsg("エラー: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selRoom = sel?.kind === "room" ? floor.rooms.find((r) => r.id === sel.id) : undefined;
  const selFx = sel?.kind === "fx" ? fixtures.find((f) => f.id === sel.id) : undefined;
  const overlapIds = useMemo(() => {
    const s = new Set<string>();
    const rs = floor.rooms.filter((r) => r.type !== "balcony");
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (overlaps(rs[i], rs[j])) { s.add(rs[i].id); s.add(rs[j].id); }
    // 切り欠き（建物の外）にかかる部屋も赤
    for (const n of notchesOf(building)) {
      const r = notchRect(building, n);
      const nr: Room = { id: "notch", name: "", type: "other", x: r.x0, y: r.y0, w: r.x1 - r.x0, d: r.y1 - r.y0 };
      for (const room of floor.rooms) if (overlaps(room, nr)) s.add(room.id);
    }
    return s;
  }, [floor.rooms, building]);

  // キーボード操作（図をクリックして選んだ後）
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "SELECT") return;
    const step = HALF;
    // 画面の向きで矢印を解釈（反転時は逆）
    const sgn = flip ? -1 : 1;
    if (selRoom) {
      if (e.key === "Delete" || e.key === "Backspace") { removeRoom(selRoom.id); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { nudgeRoom(selRoom, -step * sgn, 0); e.preventDefault(); }
      else if (e.key === "ArrowRight") { nudgeRoom(selRoom, step * sgn, 0); e.preventDefault(); }
      else if (e.key === "ArrowUp") { nudgeRoom(selRoom, 0, step * sgn); e.preventDefault(); }
      else if (e.key === "ArrowDown") { nudgeRoom(selRoom, 0, -step * sgn); e.preventDefault(); }
      else if (e.key === "r" || e.key === "R") rotateRoom(selRoom.id);
      else if (e.key === "Escape") setSel(null);
    } else if (selFx) {
      if (e.key === "Delete" || e.key === "Backspace") { removeFx(selFx.id); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { nudgeFx(selFx, -step * sgn, 0); e.preventDefault(); }
      else if (e.key === "ArrowRight") { nudgeFx(selFx, step * sgn, 0); e.preventDefault(); }
      else if (e.key === "ArrowUp") { nudgeFx(selFx, 0, step * sgn); e.preventDefault(); }
      else if (e.key === "ArrowDown") { nudgeFx(selFx, 0, -step * sgn); e.preventDefault(); }
      else if (e.key === "f" || e.key === "F") updateFx(selFx.id, { swing: selFx.swing === "minus" ? "plus" : "minus" });
      else if (e.key === "h" || e.key === "H") updateFx(selFx.id, { hinge: selFx.hinge === "end" ? "start" : "end" });
      else if (e.key === "Escape") setSel(null);
    }
  };

  const mm = (m: number) => Math.round(m * 1000).toLocaleString();

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{level}階</h3>
            <div className="flex gap-1">
              {Array.from({ length: building.floors }, (_, i) => i + 1).map((l) => (
                <button key={l} className={`rounded px-2.5 py-1 text-xs font-medium ${level === l ? "bg-brand-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`} onClick={() => { setLevel(l); setSel(null); }}>
                  {l}F
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-600">部屋（図へドラッグして置く）</div>
            <div className="flex flex-wrap gap-1">
              {ROOM_TYPES.map((t) => (
                <button
                  key={t}
                  className="touch-none cursor-grab rounded border border-slate-300 px-1.5 py-0.5 text-[11px] shadow-sm hover:brightness-95 active:cursor-grabbing"
                  style={{ background: ROOM_FILL[t] }}
                  onPointerDown={(e) => { e.preventDefault(); const [w, d] = ROOM_DEFAULT_SIZE[t]; setPlacing({ type: t, w: Math.min(w, snap(building.w)), d: Math.min(d, snap(building.d)) }); }}
                  onClick={() => { if (!ghost) addRoom(t); }}
                >
                  {ROOM_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-600">建具（壁の上へドラッグ。窓・玄関は外壁のみ）</div>
            <div className="flex flex-wrap gap-1">
              {FIXTURE_KINDS.map((k) => (
                <button
                  key={k}
                  className="touch-none cursor-grab rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] shadow-sm hover:bg-slate-50"
                  onPointerDown={(e) => { e.preventDefault(); setPlacingFx(k); }}
                  onClick={() => { if (!ghost) addFx(k, { x: building.w / 2, y: 0 }); }}
                  title={`標準幅 ${mm(FIXTURE_DEFAULT_WIDTH[k])}mm`}
                >
                  {FIXTURE_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
            <b>操作</b>：図の上でクリックして選ぶ → ドラッグで移動、青い■で大きさ変更。ドアは選んだ後に「吊元」「開く側」の○をクリック。
            <br />キー：矢印＝455mm移動、R＝90°回転、F＝開く側、H＝吊元、Delete＝削除
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => { const src = project.floors.find((f) => f.level === level - 1); if (src) setFloor((f) => ({ ...f, rooms: src.rooms.map((r) => ({ ...r, id: uid() })), fixtures: (src.fixtures ?? []).map((x) => ({ ...x, id: uid() })) })); }} disabled={level <= 1}>
              下の階をコピー
            </button>
            <button className="btn-ghost text-xs" onClick={() => { if (confirm(`${level}階の部屋と建具を全部消しますか？`)) setFloor((f) => ({ ...f, rooms: [], fixtures: [] })); }}>この階をクリア</button>
          </div>
        </div>

        <div className="card space-y-1">
          <h3 className="text-sm font-semibold">{level}階の一覧</h3>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {floor.rooms.map((r) => (
              <button key={r.id} className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${selRoom?.id === r.id ? "bg-brand-50 ring-1 ring-brand-600" : "hover:bg-slate-50"}`} onClick={() => setSel({ kind: "room", id: r.id })}>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-slate-400" style={{ background: ROOM_FILL[r.type] }} />{r.name}{overlapIds.has(r.id) && <span className="text-red-600">⚠</span>}</span>
                <span className="text-slate-500">{mm(r.w)}×{mm(r.d)}</span>
              </button>
            ))}
            {fixtures.map((fx) => (
              <button key={fx.id} className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${selFx?.id === fx.id ? "bg-brand-50 ring-1 ring-brand-600" : "hover:bg-slate-50"}`} onClick={() => setSel({ kind: "fx", id: fx.id })}>
                <span className="text-slate-700">▫ {FIXTURE_LABEL[fx.kind]}</span>
                <span className="text-slate-500">{mm(fx.width)}</span>
              </button>
            ))}
            {floor.rooms.length === 0 && <div className="text-xs text-slate-400">部屋がありません。上から図へドラッグするか「ゼロから提案」を押してください。</div>}
          </div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">日本語で指示して編集（AI）</h3>
          <textarea
            className="field h-16"
            placeholder={`例）1階のガレージをもう50cm広く／3階の洋室2つを一つに／2階にパントリーを追加`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-primary flex-1 justify-center" disabled={busy || !instruction.trim()} onClick={() => runAi("edit")}>
              {busy ? "考え中…" : "この指示で直す"}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => { const hasEnt = project.floors.some((f) => f.rooms.some((r) => r.type === "entrance")); if (confirm(hasEnt ? "玄関と階段はそのまま残し、他の部屋を作り直して提案させますか？（今の他の部屋は消えます）" : "玄関がまだ置かれていません。玄関の位置も含めて全部提案させますか？（先に玄関を置くと、その位置を守って提案します）")) runAi("generate"); }}>
              残りを提案
            </button>
          </div>
          <p className="text-[11px] text-slate-500">「残りを提案」は、あなたが置いた玄関（と階段）の位置・向きを固定して、他の部屋をAIが埋めます。</p>
          {msg && <div className={`text-xs ${msg.startsWith("エラー") ? "text-red-600" : "text-emerald-700"}`}>{msg}</div>}
        </div>

        <div className="card text-xs">
          <h3 className="mb-1 text-sm font-semibold">建物参考プラン</h3>
          <table className="w-full">
            <tbody>
              <Row k="間取り" v={summary} />
              <Row k="敷地面積" v={siteArea ? `${round(siteArea, 2)}㎡（${round(siteArea / TSUBO_M2, 2)}坪）` : "未入力"} />
              <Row k="建築面積" v={`${round(footprintArea(building), 2)}㎡`} />
              {project.floors.map((f) => (
                <Row key={f.level} k={`${f.level}階`} v={`${round(floorArea(f), 2)}㎡${balconyArea(f) ? `（＋バルコニー ${round(balconyArea(f), 2)}㎡）` : ""}`} />
              ))}
              <Row k="延床面積" v={`${round(total, 2)}㎡（${round(total / TSUBO_M2, 2)}坪）`} />
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-slate-400">外形 {mm(building.w)}×{mm(building.d)}mm は「建築可能範囲」画面で決めます。※参考プラン。面積は壁芯の概算です。</p>
        </div>
      </aside>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            <b>{project.name}</b> 建物参考プラン（{building.structureLabel}）
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={showSite} onChange={(e) => setShowSite(e.target.checked)} />敷地と道路を表示</label>
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={showFxLabels} onChange={(e) => setShowFxLabels(e.target.checked)} />建具の幅を表示</label>
            <button className="btn-ghost" onClick={() => svgRef.current && downloadSvgAsPng(svgRef.current, `${project.name}_${level}階.png`)}>この階をPNG</button>
            <button className="btn-ghost" onClick={() => allRef.current && downloadSvgAsPng(allRef.current, `${project.name}_間取り一式.png`, 2)}>全階まとめてPNG</button>
          </div>
        </div>

        {/* 選択中の要素のプロパティバー */}
        <div className="card min-h-[52px] p-2">
          {selRoom ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <input className="field w-28 py-1" value={selRoom.name} onChange={(e) => updateRoom(selRoom.id, { name: e.target.value })} />
              <select className="field w-auto py-1" value={selRoom.type} onChange={(e) => updateRoom(selRoom.id, { type: e.target.value as RoomType, name: selRoom.name === ROOM_LABEL[selRoom.type] ? ROOM_LABEL[e.target.value as RoomType] : selRoom.name })}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_LABEL[t]}</option>)}
              </select>
              <Stepper label="幅" value={selRoom.w} onMinus={() => resizeRoom(selRoom, -HALF, 0)} onPlus={() => resizeRoom(selRoom, HALF, 0)} />
              <Stepper label="奥行" value={selRoom.d} onMinus={() => resizeRoom(selRoom, 0, -HALF)} onPlus={() => resizeRoom(selRoom, 0, HALF)} />
              <span className="text-slate-500">{round(selRoom.w * selRoom.d, 2)}㎡＝{round((selRoom.w * selRoom.d) / TATAMI_M2, 1)}帖</span>
              <button className="btn-ghost py-1" onClick={() => rotateRoom(selRoom.id)}>↻ 90°回す</button>
              {selRoom.type === "stairs" && (
                <>
                  <select className="field w-auto py-1" value={selRoom.stairKind ?? "straight"} onChange={(e) => { const k = e.target.value as StairKind; const size = k === "straight" ? { w: 0.91, d: 2.73 } : { w: 1.82, d: 1.82 }; const pos = clampPos(selRoom.x, selRoom.y, size.w, size.d); updateRoom(selRoom.id, { stairKind: k, ...size, ...pos, turn: selRoom.turn ?? "left" }); }}>
                    <option value="straight">直階段</option>
                    <option value="u_turn">回り階段（1820×1820）</option>
                    <option value="l_turn">かね折れ階段</option>
                  </select>
                  {(selRoom.stairKind === "u_turn" || selRoom.stairKind === "l_turn") && (
                    <button className="btn-ghost py-1" onClick={() => updateRoom(selRoom.id, { turn: selRoom.turn === "right" ? "left" : "right" })}>曲がり: {selRoom.turn === "right" ? "右" : "左"} ⇄</button>
                  )}
                  <select className="field w-auto py-1" value={selRoom.dir ?? "up"} onChange={(e) => updateRoom(selRoom.id, { dir: e.target.value as StairDir })} title="上り始めの向き">
                    <option value="up">上り口: 底辺側から奥へ</option>
                    <option value="down">上り口: 奥から底辺側へ</option>
                    <option value="left">上り口: 右から左へ</option>
                    <option value="right">上り口: 左から右へ</option>
                  </select>
                  <button className="btn-ghost py-1" onClick={() => copyStairsToAllFloors(selRoom)}>全階に同じ階段</button>
                </>
              )}
              {overlapIds.has(selRoom.id) && <span className="font-medium text-red-600">⚠ 他の部屋と重なっています</span>}
              <button className="btn-ghost py-1 text-red-600" onClick={() => removeRoom(selRoom.id)}>削除</button>
            </div>
          ) : selFx ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <select className="field w-auto py-1" value={selFx.kind} onChange={(e) => { const k = e.target.value as FixtureKind; const width = FIXTURE_DEFAULT_WIDTH[k]; const cx = selFx.x + (selFx.along === "h" ? selFx.width / 2 : 0); const cy = selFx.y + (selFx.along === "v" ? selFx.width / 2 : 0); const pos = snapToWall(k, width, cx, cy, walls, fixtures, selFx.id); if (!pos) { setMsg("エラー: その建具はこの壁に置けません"); return; } updateFx(selFx.id, { kind: k, width, ...pos }); }}>
                {FIXTURE_KINDS.map((k) => <option key={k} value={k}>{FIXTURE_LABEL[k]}</option>)}
              </select>
              <label className="flex items-center gap-1">
                <span className="text-slate-500">幅</span>
                <select className="field w-auto py-1" value={WIDTH_CHOICES[selFx.kind].includes(selFx.width) ? String(selFx.width) : "custom"} onChange={(e) => { if (e.target.value === "custom") return; const width = Number(e.target.value); const cx = selFx.x + (selFx.along === "h" ? selFx.width / 2 : 0); const cy = selFx.y + (selFx.along === "v" ? selFx.width / 2 : 0); const pos = snapToWall(selFx.kind, width, cx, cy, walls, fixtures, selFx.id); if (!pos) { setMsg("エラー: その幅はこの壁に収まりません"); return; } updateFx(selFx.id, { width, ...pos }); }}>
                  {WIDTH_CHOICES[selFx.kind].map((w) => <option key={w} value={String(w)}>{mm(w)}mm</option>)}
                  <option value="custom">その他</option>
                </select>
                <input type="number" step="0.005" className="field w-20 py-1" value={selFx.width} onChange={(e) => updateFx(selFx.id, { width: Number(e.target.value) })} />
                <span className="text-slate-400">m</span>
              </label>
              {DOOR_KINDS.includes(selFx.kind) && (
                <>
                  <button className="btn-ghost py-1" onClick={() => updateFx(selFx.id, { hinge: selFx.hinge === "end" ? "start" : "end" })}>吊元を反対に（H）</button>
                  <button className="btn-ghost py-1" onClick={() => updateFx(selFx.id, { swing: selFx.swing === "minus" ? "plus" : "minus" })}>開く側を反対に（F）</button>
                </>
              )}
              {(selFx.kind === "sliding_single" || selFx.kind === "folding") && (
                <button className="btn-ghost py-1" onClick={() => updateFx(selFx.id, { hinge: selFx.hinge === "end" ? "start" : "end" })}>{selFx.kind === "sliding_single" ? "引く向きを反対に（H）" : "折れる側を反対に（H）"}</button>
              )}
              {selFx.kind === "folding" && <button className="btn-ghost py-1" onClick={() => updateFx(selFx.id, { swing: selFx.swing === "minus" ? "plus" : "minus" })}>開く側を反対に（F）</button>}
              <span className="text-slate-400">図の上の○をクリックしても変えられます</span>
              <button className="btn-ghost py-1 text-red-600" onClick={() => removeFx(selFx.id)}>削除</button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">部屋や建具をクリックすると、ここに設定が出ます。左のパレットから図へドラッグして追加。</div>
          )}
        </div>

        <div ref={wrapRef} className="card overflow-auto p-2 outline-none" tabIndex={0} onKeyDown={onKey}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mx-auto max-h-[70vh] w-full touch-none select-none"
            style={{ background: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif" }}
            onPointerMove={onMove}
            onPointerUp={(e) => {
              setDrag(null);
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
            onPointerLeave={() => { setDrag(null); setGhost(null); }}
            onPointerDown={(e) => { wrapRef.current?.focus(); if (e.target === svgRef.current || (e.target as Element).getAttribute("data-bg") === "1") setSel(null); }}
          >
            <rect width={W} height={H} fill="#fff" data-bg="1" />
            {showSite && <SiteContextSvg ctx={siteCtx} project={project} ox={ox} oy={oy} px={PX} flip={flip} canvas={{ w: W, h: H }} />}
            <FloorSvg
              floor={floor}
              project={project}
              ox={ox}
              oy={oy}
              px={PX}
              sel={selRoom?.id ?? null}
              overlapIds={overlapIds}
              flip={flip}
              level={level}
              onSelect={(id) => setSel({ kind: "room", id })}
              onStartDrag={(r, e) => { wrapRef.current?.focus(); const p = localOf(e); setDrag({ kind: "room-move", id: r.id, ox: r.x, oy: r.y, sx: p.x, sy: p.y, moved: false }); }}
            />
            <FixturesSvg
              fixtures={fixtures}
              project={project}
              ox={ox}
              oy={oy}
              px={PX}
              flip={flip}
              sel={selFx?.id ?? null}
              showLabels={showFxLabels}
              onSelect={(id) => setSel({ kind: "fx", id })}
              onStartDrag={(fx, e) => { wrapRef.current?.focus(); const p = localOf(e); setDrag({ kind: "fx-move", id: fx.id, ox: fx.x, oy: fx.y, sx: p.x, sy: p.y }); }}
              onSetHinge={(fx, hinge) => updateFx(fx.id, { hinge })}
              onSetSwing={(fx, swing) => updateFx(fx.id, { swing })}
            />
            <BuildingDims rooms={floor.rooms} ox={ox} oy={oy} px={PX} w={building.w} d={building.d} flip={flip} />
            {selRoom && <ResizeHandles room={selRoom} project={project} ox={ox} oy={oy} px={PX} flip={flip} onStart={(r, handle, e) => { const p = localOf(e); setDrag({ kind: "room-resize", id: r.id, handle, ox: r.x, oy: r.y, ow: r.w, od: r.d, sx: p.x, sy: p.y }); }} />}
            {placingFx && ghost && (() => {
              const gx = flip ? ox + (building.w - ghost.x) * PX : ox + ghost.x * PX;
              const gy = flip ? oy + ghost.y * PX : oy + (building.d - ghost.y) * PX;
              return <circle cx={gx} cy={gy} r={8} fill="#2f6fed" fillOpacity={0.5} style={{ pointerEvents: "none" }} />;
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
            <text x={ox} y={oy - 68} fontSize={16} fontWeight={700} fill="#222">
              {level}階　床面積 {round(floorArea(floor), 2)}㎡{balconyArea(floor) ? `（バルコニー ${round(balconyArea(floor), 2)}㎡ 別）` : ""}
            </text>
            <NorthMark x={W - 30} y={oy - 10} deg={northScreenDeg(project, "plan")} />
          </svg>
        </div>

        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold">建具表（見積・図面指示用）</summary>
          <div className="mt-2"><FixtureSchedule project={project} /></div>
        </details>

        <div className="hidden">
          <AllFloorsSvg ref={allRef} project={project} summary={summary} total={total} floorArea={floorArea} balconyArea={balconyArea} />
        </div>
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

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-slate-500">{label}</span>
      <button className="h-6 w-6 rounded border border-slate-300 leading-none hover:bg-slate-50" onClick={onMinus}>−</button>
      <span className="w-14 text-center font-medium tabular-nums">{Math.round(value * 1000).toLocaleString()}</span>
      <button className="h-6 w-6 rounded border border-slate-300 leading-none hover:bg-slate-50" onClick={onPlus}>＋</button>
    </span>
  );
}

/** 敷地・道路を描くために建物の外側へ広げる余白（m、建物座標の左右上下） */
function sitePadding(ctx: SiteContext, bw: number, bd: number, on: boolean) {
  if (!on) return { l: 0, r: 0, t: 0, b: 0 };
  const pts = [...ctx.site, ...ctx.roads.flatMap((r) => r.poly)];
  const cap = (v: number) => Math.min(5, Math.max(0.6, v));
  return {
    l: cap(-Math.min(0, ...ctx.site.map((p) => p.x), ...ctx.roads.flatMap((r) => r.poly.map((p) => p.x)))),
    r: cap(Math.max(bw, ...pts.map((p) => p.x)) - bw),
    b: cap(-Math.min(0, ...pts.map((p) => p.y))),
    t: cap(Math.max(bd, ...pts.map((p) => p.y)) - bd),
  };
}

/** 間取り図の背景に敷地の形・離れ線・道路を薄く描く */
export function SiteContextSvg({ ctx, project, ox, oy, px, flip, canvas, compact }: { ctx: SiteContext; project: Project; ox: number; oy: number; px: number; flip: boolean; canvas: { w: number; h: number }; compact?: boolean }) {
  const b = project.building;
  const toPx = (x: number, y: number) => (flip ? { x: ox + (b.w - x) * px, y: oy + y * px } : { x: ox + x * px, y: oy + (b.d - y) * px });
  const pts = (poly: { x: number; y: number }[]) => poly.map((p) => { const q = toPx(p.x, p.y); return `${q.x},${q.y}`; }).join(" ");
  const clipId = `sitectx-${Math.round(ox)}-${Math.round(oy)}-${px}`;
  const fs = compact ? 8 : 11;
  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <clipPath id={clipId}><rect x={8} y={compact ? 0 : 40} width={canvas.w - 16} height={canvas.h - (compact ? 0 : 48)} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {ctx.roads.map((r, i) => {
          const m = toPx(r.mid.x, r.mid.y);
          return (
            <g key={"road" + i}>
              <polygon points={pts(r.poly)} fill="#eceff3" stroke="#c9ced8" strokeWidth={1} />
              <text x={m.x} y={m.y - 2} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#555">道路 約{r.w.toFixed(1)}m</text>
              {!compact && <text x={m.x} y={m.y + fs + 1} textAnchor="middle" fontSize={fs - 2} fill="#777">{r.label}</text>}
            </g>
          );
        })}
        <polygon points={pts(ctx.site)} fill="rgba(246,234,211,0.35)" stroke="#6b7280" strokeWidth={1.5} strokeLinejoin="round" />
        {ctx.setback.length > 2 && <polygon points={pts(ctx.setback)} fill="none" stroke="#c0392b" strokeWidth={0.8} strokeDasharray="5 4" />}
      </g>
    </g>
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

const HANDLES: { h: Handle; fx: number; fy: number; cursor: string }[] = [
  { h: "nw", fx: 0, fy: 0, cursor: "nwse-resize" },
  { h: "n", fx: 0.5, fy: 0, cursor: "ns-resize" },
  { h: "ne", fx: 1, fy: 0, cursor: "nesw-resize" },
  { h: "w", fx: 0, fy: 0.5, cursor: "ew-resize" },
  { h: "e", fx: 1, fy: 0.5, cursor: "ew-resize" },
  { h: "sw", fx: 0, fy: 1, cursor: "nesw-resize" },
  { h: "s", fx: 0.5, fy: 1, cursor: "ns-resize" },
  { h: "se", fx: 1, fy: 1, cursor: "nwse-resize" },
];

/** 1フロア分の間取り描画 */
export function FloorSvg({ floor, project, ox, oy, px, sel, overlapIds, onSelect, onStartDrag, compact, flip, level }: {
  floor: Floor;
  project: Project;
  ox: number;
  oy: number;
  px: number;
  sel?: string | null;
  overlapIds?: Set<string>;
  onSelect?: (id: string) => void;
  onStartDrag?: (r: Room, e: React.PointerEvent) => void;
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
      <rect x={ox} y={oy} width={b.w * px} height={b.d * px} fill="#fbf7ef" stroke="none" data-bg="1" />
      {Array.from({ length: Math.floor(b.w / HALF + 1e-6) }, (_, i) => (i + 1) * HALF).map((u) => (
        <line key={"gu" + u} x1={ox + u * px} y1={oy} x2={ox + u * px} y2={oy + b.d * px} stroke={Math.abs((u / MODULE) % 1) < 1e-6 || Math.abs((u / MODULE) % 1 - 1) < 1e-6 ? "#d8dee8" : "#eef1f5"} strokeWidth={0.8} style={{ pointerEvents: "none" }} />
      ))}
      {Array.from({ length: Math.floor(b.d / HALF + 1e-6) }, (_, i) => (i + 1) * HALF).map((v) => (
        <line key={"gv" + v} x1={ox} y1={oy + (b.d - v) * px} x2={ox + b.w * px} y2={oy + (b.d - v) * px} stroke={Math.abs((v / MODULE) % 1) < 1e-6 || Math.abs((v / MODULE) % 1 - 1) < 1e-6 ? "#d8dee8" : "#eef1f5"} strokeWidth={0.8} style={{ pointerEvents: "none" }} />
      ))}
      {notchesOf(b).map((n) => { const r = notchRect(b, n); const p0 = toPx(r.x0, r.y1); const p1 = toPx(r.x1, r.y0); return <rect key={"notch" + n.corner} x={Math.min(p0.x, p1.x)} y={Math.min(p0.y, p1.y)} width={n.w * px} height={n.d * px} fill="#fff" data-bg="1" />; })}
      {floor.rooms.map((r) => {
        const p0 = toPx(r.x, r.y + r.d);
        const p1 = toPx(r.x + r.w, r.y);
        const p = { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y) };
        const w = r.w * px;
        const h = r.d * px;
        const isSel = sel === r.id;
        const bad = overlapIds?.has(r.id);
        const tatami = (r.w * r.d) / TATAMI_M2;
        const showTatami = ["ldk", "living", "bedroom", "japanese", "study", "kitchen"].includes(r.type);
        const nameSize = Math.min(compact ? 11 : 14, Math.max(7, Math.min(w / (r.name.length * 0.9 + 1), h / 2.2)));
        return (
          <g key={r.id}>
            <g onPointerDown={(e) => { e.stopPropagation(); onSelect?.(r.id); onStartDrag?.(r, e); }} className={onStartDrag ? "cursor-move" : ""}>
              <rect x={p.x} y={p.y} width={w} height={h} fill={ROOM_FILL[r.type]} stroke={isSel ? "#2f6fed" : "#1b1b1b"} strokeWidth={isSel ? 3 : 2.5} />
              {bad && <rect x={p.x + 2} y={p.y + 2} width={Math.max(0, w - 4)} height={Math.max(0, h - 4)} fill="#e11d48" fillOpacity={0.12} stroke="#e11d48" strokeWidth={1.5} strokeDasharray="5 3" style={{ pointerEvents: "none" }} />}
              {r.type === "stairs" && <StairLines x={p.x} y={p.y} w={w} h={h} px={px} dir={r.dir ?? "up"} flip={!!flip} showUp={lv < topFloor} showDown={lv > 1} compact={compact} kind={r.stairKind ?? "straight"} turn={r.turn ?? "left"} />}
              {r.type === "stairs" ? (
                <text x={p.x + 4} y={p.y + (compact ? 9 : 12)} fontSize={compact ? 8 : 10} fontWeight={700} fill="#222" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={2} paintOrder="stroke">
                  {r.name}
                </text>
              ) : (
                <text x={p.x + w / 2} y={p.y + h / 2 + (showTatami && h > 40 ? -2 : nameSize / 3)} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill="#222" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {r.name}
                </text>
              )}
              {showTatami && h > 40 && (
                <text x={p.x + w / 2} y={p.y + h / 2 + (compact ? 11 : 14)} textAnchor="middle" fontSize={compact ? 9 : 11} fill="#333" style={{ pointerEvents: "none" }} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {round(tatami, 1).toFixed(1)}帖
                </text>
              )}
            </g>
          </g>
        );
      })}
      {/* 外形線は部屋の上に描く（切り欠きが見えるように） */}
      <polygon points={footprintPolygon(b).map((q) => { const t = toPx(q.x, q.y); return `${t.x},${t.y}`; }).join(" ")} fill="none" stroke="#1b1b1b" strokeWidth={wallW} strokeLinejoin="miter" style={{ pointerEvents: "none" }} />
    </g>
  );
}

/** 選択中の部屋の大きさ変更つまみ（建具より上のレイヤーに描く） */
function ResizeHandles({ room, project, ox, oy, px, flip, onStart }: { room: Room; project: Project; ox: number; oy: number; px: number; flip: boolean; onStart: (r: Room, handle: Handle, e: React.PointerEvent) => void }) {
  const b = project.building;
  const toPx = (x: number, y: number) => (flip ? { x: ox + (b.w - x) * px, y: oy + y * px } : { x: ox + x * px, y: oy + (b.d - y) * px });
  const p0 = toPx(room.x, room.y + room.d);
  const p1 = toPx(room.x + room.w, room.y);
  const p = { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y) };
  const w = room.w * px;
  const h = room.d * px;
  // 反転時は画面上の「上」が建物座標の -y 側になるので、つまみの建物側の意味を入れ替える
  const screenHandle = (hd: Handle): Handle => {
    if (!flip) return hd;
    const map: Record<string, string> = { n: "s", s: "n", e: "w", w: "e" };
    return hd.split("").map((c) => map[c]).join("") as Handle;
  };
  return (
    <g>
      <rect x={p.x} y={p.y} width={w} height={h} fill="none" stroke="#2f6fed" strokeWidth={2.5} style={{ pointerEvents: "none" }} />
      {HANDLES.map((hd) => (
        <rect
          key={hd.h}
          x={p.x + w * hd.fx - 6}
          y={p.y + h * hd.fy - 6}
          width={12}
          height={12}
          rx={2}
          fill="#fff"
          stroke="#2f6fed"
          strokeWidth={2}
          style={{ cursor: hd.cursor }}
          onPointerDown={(e) => { e.stopPropagation(); onStart(room, screenHandle(hd.h), e); }}
        />
      ))}
    </g>
  );
}

/** 建物の寸法線: 上に幅の区切り寸法と全体、左に奥行の区切り寸法と全体（mm） */
export function BuildingDims({ rooms, ox, oy, px, w, d, flip, compact }: { rooms: Room[]; ox: number; oy: number; px: number; w: number; d: number; flip: boolean; compact?: boolean }) {
  const fs = compact ? 8 : 10;
  const L1 = compact ? 18 : 26;
  const L2 = compact ? 36 : 52;
  const mm = (m: number) => `${Math.round(m * 1000).toLocaleString()}`;
  const uniq = (vals: number[], max: number) => {
    const set = new Set<number>([0, +max.toFixed(3)]);
    for (const v of vals) if (v > 1e-6 && v < max - 1e-6) set.add(+v.toFixed(3));
    return Array.from(set).sort((a, b) => a - b);
  };
  const xs = uniq(rooms.flatMap((r) => [r.x, r.x + r.w]), w);
  const ys = uniq(rooms.flatMap((r) => [r.y, r.y + r.d]), d);
  const X = (x: number) => (flip ? ox + (w - x) * px : ox + x * px);
  const Y = (y: number) => (flip ? oy + y * px : oy + (d - y) * px);
  const tick = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth={0.7} />;
  const els: React.ReactNode[] = [];
  const yA = oy - L1, yB = oy - L2;
  els.push(<line key="ta" x1={X(0)} y1={yA} x2={X(w)} y2={yA} stroke="#333" strokeWidth={0.7} />);
  els.push(<line key="tb" x1={X(0)} y1={yB} x2={X(w)} y2={yB} stroke="#333" strokeWidth={0.9} />);
  xs.forEach((x, i) => {
    els.push(<g key={"tx" + i}>{tick(X(x), yA - 4, X(x), oy - 2)}</g>);
    if (i > 0) {
      const seg = x - xs[i - 1];
      if (seg > 0.2) els.push(<text key={"ts" + i} x={(X(x) + X(xs[i - 1])) / 2} y={yA - 3} textAnchor="middle" fontSize={fs} fill="#333">{mm(seg)}</text>);
    }
  });
  els.push(<g key="txall">{tick(X(0), yB - 5, X(0), yB + 5)}{tick(X(w), yB - 5, X(w), yB + 5)}</g>);
  els.push(<text key="tw" x={(X(0) + X(w)) / 2} y={yB - 4} textAnchor="middle" fontSize={fs + 2} fontWeight={700} fill="#222">{mm(w)}</text>);
  const xA = ox - L1, xB = ox - L2;
  els.push(<line key="la" x1={xA} y1={Y(0)} x2={xA} y2={Y(d)} stroke="#333" strokeWidth={0.7} />);
  els.push(<line key="lb" x1={xB} y1={Y(0)} x2={xB} y2={Y(d)} stroke="#333" strokeWidth={0.9} />);
  ys.forEach((y, i) => {
    els.push(<g key={"ly" + i}>{tick(xA - 4, Y(y), ox - 2, Y(y))}</g>);
    if (i > 0) {
      const seg = y - ys[i - 1];
      const my = (Y(y) + Y(ys[i - 1])) / 2;
      if (seg > 0.2) els.push(<text key={"ls" + i} x={xA - 3} y={my} textAnchor="middle" fontSize={fs} fill="#333" transform={`rotate(-90 ${xA - 3} ${my})`}>{mm(seg)}</text>);
    }
  });
  els.push(<g key="lyall">{tick(xB - 5, Y(0), xB + 5, Y(0))}{tick(xB - 5, Y(d), xB + 5, Y(d))}</g>);
  const myAll = (Y(0) + Y(d)) / 2;
  els.push(<text key="ld" x={xB - 4} y={myAll} textAnchor="middle" fontSize={fs + 2} fontWeight={700} fill="#222" transform={`rotate(-90 ${xB - 4} ${myAll})`}>{mm(d)}</text>);
  return <g style={{ pointerEvents: "none" }}>{els}</g>;
}

/** 階段: 直階段 / 回り階段（1坪・折り返し） / かね折れ。段の線と UP/DN の矢印 */
function StairLines({ x, y, w, h, px, dir, flip, showUp, showDown, compact, kind, turn }: { x: number; y: number; w: number; h: number; px: number; dir: StairDir; flip: boolean; showUp: boolean; showDown: boolean; compact?: boolean; kind: StairKind; turn: TurnSide }) {
  const screenDir: StairDir = flip ? ({ up: "down", down: "up", left: "right", right: "left" } as const)[dir] : dir;
  const screenTurn: TurnSide = flip ? (turn === "left" ? "right" : "left") : turn;
  const fs = compact ? 7 : 9;
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
      <g style={{ pointerEvents: "none" }}>
        {vertical ? stepsBetween(cx, y, cx, y + h, w / 2) : stepsBetween(x, cy, x + w, cy, h / 2)}
        {showUp && arrow(1, "UP", showDown ? -off : 0)}
        {showDown && arrow(-1, "DN", showUp ? off : 0)}
      </g>
    );
  }

  const angle = { up: 0, right: 90, down: 180, left: 270 }[screenDir];
  const mirror = screenTurn === "left" ? 1 : -1;
  const LW = screenDir === "up" || screenDir === "down" ? w : h;
  const LH = screenDir === "up" || screenDir === "down" ? h : w;
  const col = LW / 2;
  const Py = -LH / 2 + col;
  const clipId = `stclip-${Math.round(x)}-${Math.round(y)}`;
  const upright = (tx: number, ty: number, text: string) => (
    <g transform={`translate(${tx} ${ty}) scale(${mirror} 1) rotate(${-angle})`}>{label(0, 0, text)}</g>
  );
  const items: React.ReactNode[] = [];
  items.push(...stepsBetween(col / 2, LH / 2, col / 2, Py, col / 2).map((el, i) => <g key={"a" + i}>{el}</g>));
  const fanN = kind === "u_turn" ? 6 : 3;
  const a0 = 0;
  const a1 = kind === "u_turn" ? -180 : -90;
  for (let i = 0; i <= fanN; i++) {
    const a = ((a0 + ((a1 - a0) * i) / fanN) * Math.PI) / 180;
    items.push(<line key={"f" + i} x1={0} y1={Py} x2={Math.cos(a) * LW * 1.5} y2={Py + Math.sin(a) * LW * 1.5} stroke="#666" strokeWidth={0.8} clipPath={`url(#${clipId})`} />);
  }
  let endX = 0, endY = 0, endVx = 0, endVy = 0;
  if (kind === "u_turn") {
    items.push(...stepsBetween(-col / 2, Py, -col / 2, LH / 2, col / 2).map((el, i) => <g key={"b" + i}>{el}</g>));
    endX = -col / 2; endY = LH / 2 - 6; endVx = 0; endVy = 1;
  } else {
    items.push(...stepsBetween(0, Py - col / 2, -LW / 2, Py - col / 2, col / 2).map((el, i) => <g key={"b" + i}>{el}</g>));
    endX = -LW / 2 + 6; endY = Py - col / 2; endVx = -1; endVy = 0;
  }
  const sx = col / 2, sy = LH / 2 - 6;
  const path = kind === "u_turn"
    ? `M ${sx} ${sy} L ${sx} ${Py} A ${col / 2} ${col / 2} 0 0 0 ${-col / 2} ${Py} L ${endX} ${endY}`
    : `M ${sx} ${sy} L ${sx} ${Py} A ${col / 2} ${col / 2} 0 0 0 ${0} ${Py - col / 2} L ${endX} ${endY}`;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angle}) scale(${mirror} 1)`} style={{ pointerEvents: "none" }}>
      <defs>
        <clipPath id={clipId}><rect x={-LW / 2} y={-LH / 2} width={LW} height={LH} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <line x1={0} y1={Py} x2={0} y2={LH / 2} stroke="#444" strokeWidth={1} />
        {items}
        {(showUp || showDown) && <path d={path} fill="none" stroke="#c0392b" strokeWidth={1.2} />}
        {showUp && head(endX, endY, endVx, endVy)}
        {showDown && !showUp && head(sx, sy, 0, 1)}
      </g>
      {showUp && upright(sx, sy + 8, "UP")}
      {showDown && upright(endX + endVx * 8, endY + (kind === "u_turn" ? 8 : endVy * 8), "DN")}
    </g>
  );
}

/** 建具の描画。壁の上に開口を白で抜き、種類ごとの記号を描く。選択中は吊元・開く側を○で選べる */
export function FixturesSvg({ fixtures, project, ox, oy, px, flip, sel, showLabels, onSelect, onStartDrag, onSetHinge, onSetSwing, compact }: {
  fixtures: Fixture[];
  project: Project;
  ox: number;
  oy: number;
  px: number;
  flip: boolean;
  sel?: string | null;
  showLabels?: boolean;
  onSelect?: (id: string) => void;
  onStartDrag?: (fx: Fixture, e: React.PointerEvent) => void;
  onSetHinge?: (fx: Fixture, hinge: "start" | "end") => void;
  onSetSwing?: (fx: Fixture, swing: "plus" | "minus") => void;
  compact?: boolean;
}) {
  const b = project.building;
  const toPx = (x: number, y: number) => (flip ? { x: ox + (b.w - x) * px, y: oy + y * px } : { x: ox + x * px, y: oy + (b.d - y) * px });
  const wallT = compact ? 5 : 8;
  return (
    <g>
      <defs>
        <marker id="fxArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#c0392b" /></marker>
      </defs>
      {fixtures.map((fx) => {
        const isSel = sel === fx.id;
        const p0 = toPx(fx.x, fx.y);
        const alongV = fx.along === "h" ? (flip ? [-1, 0] : [1, 0]) : (flip ? [0, 1] : [0, -1]);
        const normV = fx.along === "h" ? (flip ? [0, 1] : [0, -1]) : (flip ? [-1, 0] : [1, 0]);
        const W = fx.width * px;
        const p1 = { x: p0.x + alongV[0] * W, y: p0.y + alongV[1] * W };
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const rot = (Math.atan2(alongV[1], alongV[0]) * 180) / Math.PI;
        const isDoor = DOOR_KINDS.includes(fx.kind);
        const sw = fx.swing === "minus" ? -1 : 1;
        const leftV = [alongV[1], -alongV[0]];
        const plusIsUp = leftV[0] * normV[0] + leftV[1] * normV[1] > 0;
        const ny = plusIsUp ? -sw : sw; // 開く側（local）: -1 = 上, +1 = 下
        const hingeAtEnd = fx.hinge === "end";
        const children: React.ReactNode[] = [];
        children.push(<rect key="gap" x={-W / 2} y={-wallT / 2} width={W} height={wallT} fill="#fff" />);
        if (isDoor) {
          const leafW = fx.kind === "door_parent_child" ? W * 0.66 : W;
          const hx = hingeAtEnd ? W / 2 : -W / 2;
          const dirX = hingeAtEnd ? -1 : 1;
          children.push(<line key="leaf" x1={hx} y1={0} x2={hx} y2={ny * leafW} stroke="#222" strokeWidth={1.5} />);
          const ex = hx + dirX * leafW, ey = 0;
          const sweep = (dirX * ny) > 0 ? 0 : 1;
          children.push(<path key="arc" d={`M ${hx} ${ny * leafW} A ${leafW} ${leafW} 0 0 ${sweep} ${ex} ${ey}`} fill="none" stroke="#555" strokeWidth={0.8} strokeDasharray="3 2" />);
          if (fx.kind === "door_parent_child") {
            const cx2 = hingeAtEnd ? -W / 2 : W / 2;
            children.push(<line key="child" x1={cx2} y1={0} x2={cx2} y2={ny * (W - leafW)} stroke="#222" strokeWidth={1.2} />);
          }
        } else if (fx.kind === "sliding_single") {
          // hinge=start: 左半分が戸、右へ引く。hinge=end: 右半分が戸、左へ引く
          const s = hingeAtEnd ? -1 : 1;
          children.push(<line key="rail" x1={-W / 2} y1={0} x2={W / 2} y2={0} stroke="#999" strokeWidth={0.6} />);
          children.push(<line key="panel" x1={-s * W / 2} y1={-wallT / 4} x2={0} y2={-wallT / 4} stroke="#222" strokeWidth={2} />);
          children.push(<line key="panel2" x1={0} y1={wallT / 4} x2={s * W / 2} y2={wallT / 4} stroke="#222" strokeWidth={2} />);
          children.push(<line key="ar" x1={-s * W * 0.1} y1={-wallT} x2={s * W * 0.3} y2={-wallT} stroke="#c0392b" strokeWidth={0.8} markerEnd="url(#fxArrow)" />);
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
        // 幅ラベル：ドアは開く側の反対、それ以外は壁の上側（local -y）に小さく
        const labelY = isDoor || fx.kind === "folding" ? (ny < 0 ? wallT * 1.9 : -wallT * 1.1) : -wallT * 1.1;
        const upsideDown = Math.abs(rot) > 90;
        const canPick = isSel && (isDoor || fx.kind === "sliding_single" || fx.kind === "folding");
        const canSwing = isSel && (isDoor || fx.kind === "folding");
        const pick = (cx: number, cy: number, active: boolean, title: string, onClick: () => void) => (
          <g key={title} style={{ cursor: "pointer" }} onPointerDown={(e) => { e.stopPropagation(); onClick(); }}>
            <circle cx={cx} cy={cy} r={6.5} fill={active ? "#2f6fed" : "#fff"} stroke="#2f6fed" strokeWidth={1.5} />
            <title>{title}</title>
          </g>
        );
        return (
          <g key={fx.id} transform={`translate(${mid.x} ${mid.y}) rotate(${rot})`}>
            <g onPointerDown={(e) => { e.stopPropagation(); onSelect?.(fx.id); onStartDrag?.(fx, e); }} className={onStartDrag ? "cursor-move" : ""}>
              <rect x={-W / 2 - 4} y={-wallT * 1.6} width={W + 8} height={wallT * 3.2} fill="transparent" />
              {children}
              {isSel && <rect x={-W / 2 - 4} y={-wallT * 1.6} width={W + 8} height={wallT * 3.2} fill="none" stroke="#2f6fed" strokeWidth={1.5} strokeDasharray="4 2" />}
            </g>
            {showLabels !== false && !compact && (
              <text x={0} y={labelY} textAnchor="middle" fontSize={7} fill="#666" style={{ pointerEvents: "none" }} transform={upsideDown ? `rotate(180 0 ${labelY - 2.5})` : undefined}>
                {Math.round(fx.width * 1000)}
              </text>
            )}
            {canPick && onSetHinge && pick(-W / 2 - 12, 0, !hingeAtEnd, isDoor ? "吊元をこちらに" : "戸をこちら側に", () => onSetHinge(fx, "start"))}
            {canPick && onSetHinge && pick(W / 2 + 12, 0, hingeAtEnd, isDoor ? "吊元をこちらに" : "戸をこちら側に", () => onSetHinge(fx, "end"))}
            {canSwing && onSetSwing && pick(0, -wallT * 2.6, ny < 0, "こちら側へ開く", () => onSetSwing(fx, plusIsUp ? "plus" : "minus"))}
            {canSwing && onSetSwing && pick(0, wallT * 2.6, ny > 0, "こちら側へ開く", () => onSetSwing(fx, plusIsUp ? "minus" : "plus"))}
          </g>
        );
      })}
    </g>
  );
}

export const AllFloorsSvg = forwardRef<SVGSVGElement, { project: Project; summary: string; total: number; floorArea: (f: Floor) => number; balconyArea: (f: Floor) => number }>(
  function AllFloorsSvg({ project, summary, total, floorArea, balconyArea }, ref) {
    const b = project.building;
    const px = 42;
    const ctx = siteInBuildingFrame(project.site, project.grid, project.site.fireproofException ? 0 : project.site.setback);
    const pad = sitePadding(ctx, b.w, b.d, true);
    const flip = !!project.grid?.flip;
    const padL = (flip ? pad.r : pad.l) * px;
    const padT = (flip ? pad.b : pad.t) * px;
    const cellW = b.w * px + 120 + (pad.l + pad.r) * px;
    const cellH = b.d * px + 150 + (pad.t + pad.b) * px;
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
              <NorthMark x={cx + cellW - 40} y={cy + 24} deg={northScreenDeg(project, "plan")} />
              <svg x={cx} y={cy + 30} width={cellW} height={cellH - 30} viewBox={`0 0 ${cellW} ${cellH - 30}`}>
                <SiteContextSvg ctx={ctx} project={project} ox={60 + padL} oy={50 + padT} px={px} flip={flip} canvas={{ w: cellW, h: cellH - 30 }} compact />
                <FloorSvg floor={f} project={project} ox={60 + padL} oy={50 + padT} px={px} compact flip={flip} />
                <FixturesSvg fixtures={f.fixtures ?? []} project={project} ox={60 + padL} oy={50 + padT} px={px} flip={flip} compact />
                <BuildingDims rooms={f.rooms} ox={60 + padL} oy={50 + padT} px={px} w={b.w} d={b.d} flip={flip} compact />
              </svg>
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
            ["建築面積", `${round(footprintArea(b), 2)}㎡`],
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
