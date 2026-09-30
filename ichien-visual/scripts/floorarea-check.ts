import { floorAreaOf } from "../src/lib/geometry";
import { lessonProject3 } from "../src/lib/sample";
const b = { ...lessonProject3().building, w: 7.735, d: 5.915, notches: [{ corner: "NW" as const, w: 1.82, d: 0.91 }] };
const rect = [{ type: "ldk", x: 0, y: 0, w: 7.735, d: 5.915 }];
console.log("全面1室（切り欠き除外）:", floorAreaOf(b, rect).toFixed(3), "期待", (7.735 * 5.915 - 1.82 * 0.91).toFixed(3));
const overlap = [{ type: "stairs", x: 0, y: 0, w: 0.91, d: 2.73 }, { type: "toilet", x: 0, y: 0, w: 0.91, d: 1.365 }];
console.log("階段下トイレ（重ね）:", floorAreaOf(b, overlap).toFixed(3), "期待", (0.91 * 2.73).toFixed(3));
console.log("バルコニー除外:", floorAreaOf(b, [{ type: "balcony", x: 0, y: 0, w: 3.64, d: 0.91 }]).toFixed(3));
