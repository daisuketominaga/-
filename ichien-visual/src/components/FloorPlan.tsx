"use client";

import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import type { Building, Project, Room, RoomType, Floor, StairDir, StairKind, TurnSide, Fixture, FixtureKind } from "@/lib/types";
import { roomGroups, groupOutline, mergeWithNeighbors, touchLength } from "@/lib/roomGroups";
import { ROOM_FILL, ROOM_LABEL, ROOM_DEFAULT_SIZE, FIXTURE_LABEL, FIXTURE_DEFAULT_WIDTH, TATAMI_M2, TSUBO_M2, HALF, MODULE } from "@/lib/types";
import { round, northScreenDeg, footprintArea, footprintPolygon, notchesOf, notchRect, roadFaceOf, floorAreaOf, siteAreaOf } from "@/lib/geometry";
import { downloadSvgAsPng, uid } from "@/lib/store";
import { siteInBuildingFrame, clearances, type SiteContext } from "@/lib/grid";
import FixtureSchedule from "./FixtureSchedule";
import { wallSegments, EXTERIOR_ONLY, DOOR_KINDS, DEFAULT_WALL_EXT, DEFAULT_WALL_INT, type Wall } from "@/lib/walls";
import { sitePadding, SiteContextSvg, NorthMark, FloorSvg, FixturesSvg, BuildingDims, AllFloorsSvg, FurnitureSvg } from "./plan/PlanParts";
import { autoFurniture } from "@/lib/furniture";
import PlanSheetPanel from "./plan/PlanSheetPanel";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

const PX = 60; // px per m
const snap = (v: number) => round(Math.round(v / HALF) * HALF, 3);

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
  const [parking, setParking] = useState<"none" | "outdoor" | "builtin1" | "builtin2">("outdoor");
  const [keepFixed, setKeepFixed] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [showFxLabels, setShowFxLabels] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
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
  // 家具（配置イメージ）: 保存済みはそのまま、未保存の部屋は自動配置
  const furnitureItems = useMemo(() => {
    if (!showFurniture) return [];
    let n = 0;
    return autoFurniture(building, floor.rooms, fixtures, () => `tmp${++n}`).items;
  }, [showFurniture, building, floor.rooms, fixtures]);
  /** 自動配置の結果を部屋に保存する（以後その部屋は手で消すまで固定） */
  const saveFurniture = () => {
    const { items } = autoFurniture(building, floor.rooms, fixtures, uid);
    setFloor((f) => ({
      ...f,
      rooms: f.rooms.map((r) => {
        const mine = items.filter((it) => it.x >= r.x - 1e-6 && it.y >= r.y - 1e-6 && it.x <= r.x + r.w + 1e-6 && it.y <= r.y + r.d + 1e-6);
        return r.type === "stairs" || r.type === "balcony" ? r : { ...r, furniture: mine };
      }),
    }));
    setMsg("家具の配置を保存しました（この階）。もう一度自動で置き直すときは「家具を消す」を押してください");
  };
  const clearFurniture = () => {
    setFloor((f) => ({ ...f, rooms: f.rooms.map((r) => { const { furniture: _drop, ...rest } = r; void _drop; return rest; }) }));
    setMsg("保存していた家具を消しました。図には自動配置の家具が出ます");
  };

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

  const floorArea = (f: Floor) => floorAreaOf(building, f.rooms);
  const balconyArea = (f: Floor) => f.rooms.filter((r) => r.type === "balcony").reduce((a, r) => a + r.w * r.d, 0);
  const total = project.floors.reduce((a, f) => a + floorArea(f), 0);
  const siteArea = siteAreaOf(project.site);

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
    const r: Room = { id: uid(), name: ROOM_LABEL[type], type, x: pos.x, y: pos.y, w, d, ...(type === "stairs" ? { dir: "up" as StairDir, stairKind: "straight" as StairKind } : {}), ...(type === "bath" ? { bathSize: "1616" } : {}), ...(type === "washroom" ? { vanity: 1650 } : {}) };
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
      const fixed = mode === "generate" && keepFixed ? project.floors.flatMap((f) => f.rooms).filter((r) => r.type === "entrance" || r.type === "stairs").map((r) => r.id) : undefined;
      // 道路側の面（建物座標）と、道路境界までの空き（屋外駐車の可否の目安）
      const roadFace = roadFaceOf(project.site, project.building) ?? "S";
      const cl = clearances(project.site, project.grid, project.building.w, project.building.d);
      const roadClearance = roadFace === "S" ? cl.bottom : roadFace === "N" ? cl.top : roadFace === "W" ? cl.left : cl.right;
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, instruction, project: { building: { ...project.building, notches: project.building.notches ?? [] }, floors: project.floors, site: { areaOverride: siteArea, coverageRatio: project.site.coverageRatio, farRatio: project.site.farRatio } }, level, fixed, options: { parking, roadFace, roadClearance } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "失敗しました");
      // 固定した部屋は元のまま戻す。建具は新しい壁の上に残るものだけ残す
      setProject((p) => ({
        ...p,
        // 返ってこなかった階は元のまま残す（編集で他の階が消えないように）
        floors: [...p.floors.filter((o) => !(json.floors as Floor[]).some((f) => f.level === o.level)), ...(json.floors as Floor[])].sort((a, b) => a.level - b.level).map((f) => {
          if (!(json.floors as Floor[]).some((g) => g.level === f.level)) return f;
          const old = p.floors.find((x) => x.level === f.level);
          const keep = (old?.rooms ?? []).filter((r) => fixed?.includes(r.id));
          const rooms = [...f.rooms.filter((r) => !keep.some((k) => k.id === r.id)), ...keep];
          const fixtures = (old?.fixtures ?? []).filter((fx) => fixtureOnWall(fx, rooms));
          return { ...f, rooms, fixtures };
        }),
      }));
      const issues = (json.issues as string[] | undefined) ?? [];
      setMsg((json.notes || "更新しました") + (issues.length ? `\n自動検査で残った注意 ${issues.length} 件（手で直してください）: ${issues.slice(0, 4).join(" ／ ")}${issues.length > 4 ? " …" : ""}` : "\n自動検査（910mm・重なり・隙間・玄関とガレージの向き）は合格です"));
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
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-600">階数</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className={`rounded px-2 py-0.5 ${building.floors === n ? "bg-slate-800 text-white" : "bg-slate-100 hover:bg-slate-200"}`}
                title={n === 1 ? "平屋にする" : `${n}階建てにする`}
                onClick={() => {
                  if (n === building.floors) return;
                  const gone = project.floors.filter((f) => f.level > n && f.rooms.length > 0);
                  if (gone.length && !confirm(`${gone.map((f) => `${f.level}階`).join("・")}の部屋（${gone.reduce((c, f) => c + f.rooms.length, 0)}室）が消えます。${n === 1 ? "平屋" : `${n}階建て`}にしますか？`)) return;
                  setProject((p) => {
                    const fh = [...p.building.floorHeights];
                    while (fh.length < n) fh.push(fh[fh.length - 1] ?? 2.4);
                    // 「木造3階建て」のような表記も階数に合わせる
                    const label = /(\d階建て|平屋)/.test(p.building.structureLabel) ? p.building.structureLabel.replace(/(\d階建て|平屋)/, n === 1 ? "平屋" : `${n}階建て`) : p.building.structureLabel;
                    return { ...p, building: { ...p.building, floors: n, floorHeights: fh, structureLabel: label }, floors: p.floors.filter((f) => f.level <= n) };
                  });
                  if (level > n) setLevel(n);
                  setSel(null);
                  setMsg(`${n === 1 ? "平屋" : `${n}階建て`}にしました。参考プランを作り直すと階数に合わせた間取りになります`);
                }}
              >
                {n === 1 ? "平屋" : `${n}階建て`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[11px]" title="図の壁の太さだけに使う値です（面積は壁芯で計算）。建築士の確認前の仮の値です">
            <span className="text-slate-600">壁厚（図示用・仮）</span>
            <span className="text-slate-500">外壁</span>
            <input type="number" step={5} min={50} max={400} className="field w-16 px-1 py-0.5" value={Math.round((building.wallExt ?? DEFAULT_WALL_EXT) * 1000)} onChange={(e) => { const v = Number(e.target.value) / 1000; setProject((p) => ({ ...p, building: { ...p.building, wallExt: v > 0.02 ? v : undefined } })); }} />
            <span className="text-slate-500">内壁</span>
            <input type="number" step={5} min={50} max={400} className="field w-16 px-1 py-0.5" value={Math.round((building.wallInt ?? DEFAULT_WALL_INT) * 1000)} onChange={(e) => { const v = Number(e.target.value) / 1000; setProject((p) => ({ ...p, building: { ...p.building, wallInt: v > 0.02 ? v : undefined } })); }} />
            <span className="text-slate-400">mm</span>
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
          </div>
          <div className="space-y-1 rounded bg-slate-50 p-2 text-xs">
            <div className="font-medium">参考プランを作る（道路の向き・車庫込み・910mmモジュール）</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">駐車</span>
              <select className="field w-auto py-0.5" value={parking} onChange={(e) => setParking(e.target.value as typeof parking)}>
                <option value="outdoor">屋外に1台（建物の外）</option>
                <option value="builtin1">ビルトイン1台</option>
                <option value="builtin2">ビルトイン2台</option>
                <option value="none">なし</option>
              </select>
              <label className="flex items-center gap-1"><input type="checkbox" checked={keepFixed} onChange={(e) => setKeepFixed(e.target.checked)} />置いた玄関・階段は動かさない</label>
            </div>
            {(() => { const rf = roadFaceOf(project.site, project.building); const cl = clearances(project.site, project.grid, project.building.w, project.building.d); const gap = rf === "S" ? cl.bottom : rf === "N" ? cl.top : rf === "W" ? cl.left : rf === "E" ? cl.right : null; return (
              <div className="text-[11px] text-slate-500">道路側の面: {rf ? ({ S: "底辺側", N: "奥側", W: "左側", E: "右側" } as const)[rf] : "道路未設定"}。道路境界までの空き {gap === null ? "―" : `${Math.round(gap * 1000).toLocaleString()}mm`}{gap !== null && parking === "outdoor" ? (gap >= 5.0 ? "（屋外駐車 1台分の奥行 5.0m は確保できています）" : "（屋外駐車には奥行 5.0m 程度が必要です。建物を奥へ動かすか、ビルトインを検討）") : ""}</div>
            ); })()}
            <button className="btn-primary w-full justify-center" disabled={busy} onClick={() => { if (confirm(keepFixed && project.floors.some((f) => f.rooms.some((r) => r.type === "entrance" || r.type === "stairs")) ? "玄関と階段はそのまま残し、他の部屋を作り直して提案させますか？（今の他の部屋は消えます）" : "全階の間取りをAIに提案させます。今の部屋は消えます。よろしいですか？")) runAi("generate"); }}>
              {busy ? "考え中…" : "参考プランを作る"}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">上の欄に「1階に和室」「ガレージの横に土間収納」など要望を書いてから押すと、それも反映します。結果は 910mm の線に合わせて作らせていますが、はみ出しや重なり（赤）が出たら手で直してください。</p>
          {msg && <div className={`whitespace-pre-line text-xs ${msg.startsWith("エラー") ? "text-red-600" : "text-emerald-700"}`}>{msg}</div>}
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
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={showFurniture} onChange={(e) => setShowFurniture(e.target.checked)} />家具（配置イメージ）</label>
            <button className="btn-ghost" title="自動配置した家具をこの階の部屋に保存して固定する" onClick={saveFurniture}>家具を保存</button>
            {floor.rooms.some((r) => r.furniture) && <button className="btn-ghost" onClick={clearFurniture}>家具を消す</button>}
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
              <span className="text-slate-500">{round(selRoom.w * selRoom.d, 2)}㎡＝{round((selRoom.w * selRoom.d) / TATAMI_M2, 1)}帖{selRoom.group && (() => { const g = floor.rooms.filter((r) => r.group === selRoom.group); const a = g.reduce((s, r) => s + r.w * r.d, 0); return <>（合体後 {round(a, 2)}㎡＝{round(a / TATAMI_M2, 1)}帖）</>; })()}</span>
              <button className="btn-ghost py-1" onClick={() => rotateRoom(selRoom.id)}>↻ 90°回す</button>
              {floor.rooms.some((r) => r.id !== selRoom.id && r.name === selRoom.name && r.type === selRoom.type && r.type !== "stairs" && touchLength(r, selRoom) > 1e-6 && r.group !== (selRoom.group ?? "__none__")) && (
                <button className="btn-ghost py-1" title="隣り合う同じ名前の部屋と 1 つにする。矩形になるなら 1 つの部屋に、L 字なら内側の壁を消して帖数を合計で表示" onClick={() => {
                  const res = mergeWithNeighbors(floor.rooms, selRoom.id, uid);
                  setFloor((f) => ({ ...f, rooms: res.rooms }));
                  const kept = res.rooms.find((r) => r.id === selRoom.id) ?? res.rooms.find((r) => r.name === selRoom.name);
                  if (kept) setSel({ kind: "room", id: kept.id });
                  setMsg(res.rect ? `${res.merged} つの${selRoom.name}を 1 つの部屋にまとめました` : `${res.merged} つの${selRoom.name}を L 字の 1 部屋として表示します（内側の壁なし・帖数は合計）`);
                }}>隣の同名と合体</button>
              )}
              {selRoom.group && <button className="btn-ghost py-1" onClick={() => updateRoom(selRoom.id, { group: undefined })}>合体を解く</button>}
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
              {selRoom.type === "bath" && (
                <select className="field w-auto py-1" value={selRoom.bathSize ?? ""} onChange={(e) => { const k = e.target.value; const size = { "1216": { w: 1.365, d: 1.82 }, "1616": { w: 1.82, d: 1.82 }, "1620": { w: 1.82, d: 2.275 }, "1818": { w: 2.275, d: 2.275 } }[k]; if (!size) { updateRoom(selRoom.id, { bathSize: undefined }); return; } const sw = selRoom.w >= selRoom.d ? { w: Math.max(size.w, size.d), d: Math.min(size.w, size.d) } : size; const pos = clampPos(selRoom.x, selRoom.y, sw.w, sw.d); updateRoom(selRoom.id, { bathSize: k, ...sw, ...pos }); }} title="ユニットバスの呼称">
                  <option value="">浴室サイズ: 自由</option>
                  <option value="1216">1216（1.365×1.82）</option>
                  <option value="1616">1616（1.82×1.82）</option>
                  <option value="1620">1620（1.82×2.275）</option>
                  <option value="1818">1818（2.275×2.275）</option>
                </select>
              )}
              {selRoom.type === "washroom" && (
                <select className="field w-auto py-1" value={selRoom.vanity ?? ""} onChange={(e) => updateRoom(selRoom.id, { vanity: e.target.value ? Number(e.target.value) : undefined })} title="洗面台の幅">
                  <option value="">洗面台: なし</option>
                  {[600, 750, 900, 1200, 1650].map((v) => <option key={v} value={v}>洗面台 {v}mm{Math.min(selRoom.w, selRoom.d) * 1000 < v + 100 && Math.max(selRoom.w, selRoom.d) * 1000 < v + 100 ? "（部屋が小さい）" : ""}</option>)}
                </select>
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
              overlay={showFurniture ? <FurnitureSvg items={furnitureItems} project={project} ox={ox} oy={oy} px={PX} flip={flip} /> : null}
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

        <details className="card" open>
          <summary className="cursor-pointer text-sm font-semibold">図面出力（全階を A4 横 1 枚に・PNG／印刷 PDF）</summary>
          <div className="mt-2"><PlanSheetPanel project={project} /></div>
        </details>

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


