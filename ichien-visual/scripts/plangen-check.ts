// 参考プランの後処理（結合・隙間埋め・検査）の単体テスト: npx tsx scripts/plangen-check.ts
import { mergeRooms, fillGaps, validatePlan, bathSizeOf } from "../src/lib/planGen";
const b = { w: 8.19, d: 6.37, notches: [{ corner: "NW", w: 1.82, d: 1.82 }] };
// 本番ログの教材3・修正後の結果（1F 隙間 2.9㎡、浴室半マス）と 2F の LDK 細切れ
const f1 = [
  { id: "a", name: "洋室", type: "bedroom", x: 0, y: 0, w: 2.73, d: 4.55 }, { id: "b", name: "収納", type: "closet", x: 1.82, y: 4.55, w: 0.91, d: 1.82 },
  { id: "c", name: "玄関", type: "entrance", x: 2.73, y: 0, w: 1.82, d: 1.365 }, { id: "d", name: "トイレ", type: "toilet", x: 4.55, y: 0, w: 0.91, d: 1.365 },
  { id: "e", name: "ホール", type: "hall", x: 2.73, y: 1.365, w: 2.73, d: 1.365 }, { id: "f", name: "階段", type: "stairs", x: 2.73, y: 2.73, w: 0.91, d: 2.73, dir: "up" },
  { id: "g", name: "洗面・脱衣室", type: "washroom", x: 3.64, y: 2.73, w: 1.82, d: 1.365 }, { id: "h", name: "浴室", type: "bath", x: 3.64, y: 4.095, w: 1.82, d: 1.82 },
  { id: "i", name: "収納", type: "storage", x: 2.73, y: 5.915, w: 2.73, d: 0.455 }, { id: "j", name: "ガレージ", type: "garage", x: 5.46, y: 0, w: 2.73, d: 5.46 },
];
const f2 = [
  { id: "1", name: "LDK", type: "ldk", x: 0, y: 0, w: 1.82, d: 4.55 }, { id: "2", name: "LDK", type: "ldk", x: 1.82, y: 0, w: 0.91, d: 6.37 }, { id: "3", name: "LDK", type: "ldk", x: 2.73, y: 0, w: 0.91, d: 2.73 },
  { id: "4", name: "LDK", type: "ldk", x: 2.73, y: 5.46, w: 0.91, d: 0.91 }, { id: "5", name: "LDK", type: "ldk", x: 3.64, y: 0, w: 0.91, d: 6.37 }, { id: "6", name: "LDK", type: "ldk", x: 4.55, y: 1.82, w: 0.91, d: 4.55 },
  { id: "7", name: "LDK", type: "ldk", x: 5.46, y: 0, w: 2.73, d: 6.37 }, { id: "8", name: "トイレ", type: "toilet", x: 4.55, y: 0, w: 0.91, d: 1.365 }, { id: "9", name: "収納", type: "storage", x: 4.55, y: 1.365, w: 0.91, d: 0.455 },
  { id: "s", name: "階段", type: "stairs", x: 2.73, y: 2.73, w: 0.91, d: 2.73, dir: "up" },
];
const before = validatePlan(b, [{ level: 1, rooms: f1 }, { level: 2, rooms: f2 }], "S", "builtin1");
console.log("before:", before);
const r1 = fillGaps(b, mergeRooms(f1));
const r2 = fillGaps(b, mergeRooms(f2));
console.log("1F added:", r1.filter((r) => !f1.some((o) => o.id === r.id)).map((r) => `${r.name} ${r.x},${r.y} ${r.w}×${r.d}`));
console.log("2F rooms:", r2.length, r2.map((r) => `${r.name} ${r.x},${r.y} ${r.w}×${r.d}`));
const after = validatePlan(b, [{ level: 1, rooms: r1 }, { level: 2, rooms: r2 }], "S", "builtin1");
console.log("after:", after);
console.log("bath sizes:", bathSizeOf(1.82, 1.82), bathSizeOf(1.365, 1.82), bathSizeOf(1.82, 2.275), bathSizeOf(2.275, 2.275));
const area = (rs: { w: number; d: number }[]) => rs.reduce((s, r) => s + r.w * r.d, 0);
console.log("2F area", area(r2).toFixed(3), "expected", (b.w * b.d - 1.82 * 1.82).toFixed(3));
