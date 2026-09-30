// 階段状の最大範囲テスト: npx tsx scripts/stairtest.ts
import { sampleProject, lessonProject1, lessonProject2 } from "../src/lib/sample";
import { maxStair, maxRect, baseFrame, footprintFits, buildingFromGrid } from "../src/lib/grid";
import { insetPolygon, footprintArea, polygonArea } from "../src/lib/geometry";

for (const [label, p] of [["サンプル(藤沢)", sampleProject()], ["教材1", lessonProject1()], ["教材2", lessonProject2()]] as const) {
  const setback = 0.6;
  for (let e = 0; e < p.site.points.length; e++) {
    const r = maxStair(p.site, e, setback, 0);
    const rect = maxRect(p.site, e, setback);
    const g = { ...p.grid, baseEdge: e, u: r.u, v: r.v };
    const b = { ...buildingFromGrid(p.site, g, r.w, r.d, p.building), notches: r.notches };
    const f = baseFrame(p.site, e);
    const inner = insetPolygon(p.site.points, setback);
    const fits = r.cells ? footprintFits(f, inner, g, b) : null;
    console.log(label, `辺${e + 1}`, `階段 ${r.area}㎡ (${r.cells}マス, 枠 ${r.w}×${r.d}, 切り欠き ${r.notches.length})`, `矩形 ${rect.area.toFixed(3)}㎡`, "内側:", fits, "面積一致:", Math.abs(footprintArea(b) - r.area) < 1e-3, "敷地", polygonArea(p.site.points).toFixed(2));
  }
}
