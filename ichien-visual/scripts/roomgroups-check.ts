import { roomGroups, groupOutline, mergeWithNeighbors } from "../src/lib/roomGroups";
import type { Room } from "../src/lib/types";
let n = 0; const uid = () => "g" + ++n;
// 画面の 3 階バルコニー: 4.55×3.64 と、その上の 3.64×0.91（L 字）
const rooms: Room[] = [
  { id: "b1", name: "バルコニー", type: "balcony", x: 0, y: 0, w: 4.55, d: 3.64 },
  { id: "b2", name: "バルコニー", type: "balcony", x: 0, y: 3.64, w: 3.64, d: 0.91 },
  { id: "y1", name: "洋室", type: "bedroom", x: 4.55, y: 0, w: 2.73, d: 3.64 },
  { id: "y2", name: "洋室", type: "bedroom", x: 7.28, y: 0, w: 2.73, d: 3.64 },
];
const r1 = mergeWithNeighbors(rooms, "b1", uid);
console.log("L字:", r1.merged, r1.rect, r1.rooms.filter((r) => r.type === "balcony").map((r) => `${r.id} g=${r.group}`));
console.log("groups:", roomGroups(r1.rooms).map((g) => g.map((r) => r.id)));
const seg = groupOutline(r1.rooms.filter((r) => r.type === "balcony"));
console.log("outline segs:", seg.length, seg.map((s) => `${s.along} (${s.x1},${s.y1})-(${s.x2},${s.y2})`));
// 同名の洋室 2 つ（辺全体で接する）→ 1 つの矩形に
const r2 = mergeWithNeighbors(rooms, "y1", uid);
console.log("矩形:", r2.merged, r2.rect, r2.rooms.filter((r) => r.type === "bedroom").map((r) => `${r.id} ${r.x},${r.y} ${r.w}×${r.d} g=${r.group}`));
// 何もしていない状態ではグループ化されない
console.log("no auto group:", roomGroups(rooms).map((g) => g.length));
