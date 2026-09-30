// 隣地・北側斜線の天空率テスト:  npx tsx scripts/skytest-boundary.ts
import { sampleProject, lessonProject3 } from "../src/lib/sample";
import { checkSkyFactorBoundary } from "../src/lib/skyFactor";
import { levels } from "../src/lib/heightLimits";

for (const [label, p] of [["sample 4F", (() => { const q = sampleProject(); q.building.floors = 4; q.building.floorHeights = [2.4, 2.4, 2.4, 2.4]; q.building.roof = "flat"; return q; })()], ["教材3", lessonProject3()]] as const) {
  const lv = levels(p.building);
  console.log("==", label, "max", lv.max.toFixed(2));
  for (const e of p.site.edges.filter((x) => !x.road)) {
    const t0 = Date.now();
    const r = checkSkyFactorBoundary({ site: p.site, grid: p.grid, building: p.building, kind: "neighbor", edgeIndex: e.index, base: 20, slope: 1.25, eave: lv.eave, maxHeight: lv.max });
    console.log(" 隣地 辺", e.index, "error" in r ? r.error : `ok=${r.ok} worst=${r.worst.toFixed(3)} pts=${r.points.length} ${Date.now() - t0}ms`);
  }
  for (const i of p.site.points.map((_, i) => i)) {
    const t0 = Date.now();
    const r = checkSkyFactorBoundary({ site: p.site, grid: p.grid, building: p.building, kind: "north", edgeIndex: i, base: 5, slope: 1.25, eave: lv.eave, maxHeight: lv.max, lowRise: true });
    console.log(" 北側 辺", i, "error" in r ? r.error : `ok=${r.ok} worst=${r.worst.toFixed(3)} pts=${r.points.length} ${r.points.map((q) => `${q.conform}/${q.plan}`).join(" ")} ${Date.now() - t0}ms ${r.info.note.join(";")}`);
  }
}
