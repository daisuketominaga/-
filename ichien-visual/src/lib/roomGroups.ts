import type { Room } from "./types";

export type Seg = { x1: number; y1: number; x2: number; y2: number; along: "h" | "v" };

const EPS = 1e-6;

/** 2つの矩形が辺で接している長さ（重なりではなく「隣り合い」） */
export function touchLength(a: Room, c: Room): number {
  // 縦の辺で接する
  if (Math.abs(a.x + a.w - c.x) < EPS || Math.abs(c.x + c.w - a.x) < EPS) {
    return Math.min(a.y + a.d, c.y + c.d) - Math.max(a.y, c.y);
  }
  // 横の辺で接する
  if (Math.abs(a.y + a.d - c.y) < EPS || Math.abs(c.y + c.d - a.y) < EPS) {
    return Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
  }
  return 0;
}

const groupable = (r: Room) => r.type !== "stairs";

/** 同じ group を持つ部屋をひとつのグループにまとめる（L 字の LDK など） */
export function roomGroups(rooms: Room[]): Room[][] {
  const parent = rooms.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], c = rooms[j];
      if (!groupable(a) || !groupable(c) || !a.group || a.group !== c.group) continue;
      parent[find(i)] = find(j);
    }
  const map = new Map<number, Room[]>();
  rooms.forEach((r, i) => {
    const k = find(i);
    map.set(k, [...(map.get(k) ?? []), r]);
  });
  return Array.from(map.values());
}

/** 区間 [a0,a1] から複数の区間を引く */
function subtract(a0: number, a1: number, cuts: [number, number][]): [number, number][] {
  let parts: [number, number][] = [[a0, a1]];
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = [];
    for (const [p0, p1] of parts) {
      if (c1 <= p0 + EPS || c0 >= p1 - EPS) next.push([p0, p1]);
      else {
        if (c0 > p0 + EPS) next.push([p0, c0]);
        if (c1 < p1 - EPS) next.push([c1, p1]);
      }
    }
    parts = next;
  }
  return parts.filter(([p0, p1]) => p1 - p0 > EPS);
}

/** グループの外周線（矩形同士が接している部分は消す） */
export function groupOutline(group: Room[]): Seg[] {
  const segs: Seg[] = [];
  for (const r of group) {
    const others = group.filter((o) => o !== r);
    // 上下の辺（横線）
    for (const y of [r.y, r.y + r.d]) {
      const cuts: [number, number][] = [];
      for (const o of others) {
        if (Math.abs(o.y - y) < EPS || Math.abs(o.y + o.d - y) < EPS) {
          const c0 = Math.max(r.x, o.x), c1 = Math.min(r.x + r.w, o.x + o.w);
          if (c1 > c0 + EPS) cuts.push([c0, c1]);
        }
      }
      for (const [x1, x2] of subtract(r.x, r.x + r.w, cuts)) segs.push({ x1, y1: y, x2, y2: y, along: "h" });
    }
    // 左右の辺（縦線）
    for (const x of [r.x, r.x + r.w]) {
      const cuts: [number, number][] = [];
      for (const o of others) {
        if (Math.abs(o.x - x) < EPS || Math.abs(o.x + o.w - x) < EPS) {
          const c0 = Math.max(r.y, o.y), c1 = Math.min(r.y + r.d, o.y + o.d);
          if (c1 > c0 + EPS) cuts.push([c0, c1]);
        }
      }
      for (const [y1, y2] of subtract(r.y, r.y + r.d, cuts)) segs.push({ x1: x, y1, x2: x, y2, along: "v" });
    }
  }
  return segs;
}

/** 同じ group の部屋が辺全体で接していて、合わせると矩形になるものを 1 つの矩形にまとめる */
export function mergeRectRooms(rooms: Room[]): Room[] {
  const out = rooms.map((r) => ({ ...r }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], c = out[j];
        if (!groupable(a) || !groupable(c) || a.name !== c.name || a.type !== c.type || !a.group || a.group !== c.group) continue;
        const eq = (p: number, q: number) => Math.abs(p - q) < EPS;
        if (eq(a.y, c.y) && eq(a.d, c.d) && (eq(a.x + a.w, c.x) || eq(c.x + c.w, a.x))) {
          out[i] = { ...a, x: +Math.min(a.x, c.x).toFixed(4), w: +(a.w + c.w).toFixed(4) };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
        if (eq(a.x, c.x) && eq(a.w, c.w) && (eq(a.y + a.d, c.y) || eq(c.y + c.d, a.y))) {
          out[i] = { ...a, y: +Math.min(a.y, c.y).toFixed(4), d: +(a.d + c.d).toFixed(4) };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
      }
  }
  return out;
}

/** 選んだ部屋を、隣り合う同じ名前・種類の部屋と合体させる。矩形にまとまるなら 1 つに、L 字なら同じ group にして 1 つの部屋として描く */
export function mergeWithNeighbors(rooms: Room[], id: string, newId: () => string): { rooms: Room[]; merged: number; rect: boolean } {
  const me = rooms.find((r) => r.id === id);
  if (!me || !groupable(me)) return { rooms, merged: 0, rect: false };
  const gid = me.group ?? newId();
  const members = new Set<string>([me.id, ...rooms.filter((r) => r.group && r.group === me.group).map((r) => r.id)]);
  // 接している同名の部屋を芋づる式に集める
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rooms) {
      if (members.has(r.id) || !groupable(r) || r.name !== me.name || r.type !== me.type) continue;
      if (rooms.some((m) => members.has(m.id) && touchLength(m, r) > EPS)) { members.add(r.id); grew = true; }
    }
  }
  if (members.size < 2) return { rooms, merged: 0, rect: false };
  const grouped = rooms.map((r) => (members.has(r.id) ? { ...r, group: gid } : r));
  const out = mergeRectRooms(grouped);
  const left = out.filter((r) => r.group === gid);
  // 1 つの矩形にまとまったなら group は不要
  return { rooms: left.length === 1 ? out.map((r) => (r.group === gid ? { ...r, group: undefined } : r)) : out, merged: members.size, rect: left.length === 1 };
}
