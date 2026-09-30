// 教材3（架空・3階建て）: 斜線・天空率・日影・L字・寄棟の動作確認   npx tsx scripts/lesson3-check.ts
import { lessonProject3 } from "../src/lib/sample";
import { levels, checkLimits3D, roadInfos, roadLevelOffset, elevationSilhouette } from "../src/lib/heightLimits";
import { footprintArea, polygonArea, roofRise, footprintPolygon, buildingSolids } from "../src/lib/geometry";
import { checkSkyFactor } from "../src/lib/skyFactor";
import { checkShadow } from "../src/lib/shadow";

const p = lessonProject3();
const b = p.building;
const lv = levels(b);
const area = p.site.areaOverride ?? polygonArea(p.site.points);
console.log("建物", b.w, "x", b.d, "切り欠き", b.notches, "外形", footprintPolygon(b).map((q) => `(${q.x},${q.y})`).join(" "));
console.log("建築面積", footprintArea(b).toFixed(2), "建ぺい率", ((footprintArea(b) / area) * 100).toFixed(2), "% (上限60)");
console.log("軒高", lv.eave.toFixed(3), "最高", lv.max.toFixed(3), "rise(寄棟)", roofRise(b).toFixed(3), "立体の数", buildingSolids(b, lv.eave, roofRise(b), lv.max).length);
for (const l of checkLimits3D(p, 0.1)) console.log(l.key, l.name, "over", l.over.toFixed(3), l.worst ? `worst x${l.worst.x.toFixed(2)} y${l.worst.y.toFixed(2)} z${l.worst.z.toFixed(3)} limit${l.worst.limit.toFixed(3)}` : "");
const rd = roadInfos(p)[0];
console.log("道路", rd);
const t0 = Date.now();
const sky = checkSkyFactor({ site: p.site, grid: p.grid, building: b, slope: 1.25, applyDist: 20, eave: lv.eave, maxHeight: lv.max, roadEdgeIndex: rd.edgeIndex, effWidth: rd.effWidth, zOff: roadLevelOffset(p) });
console.log("天空率", Date.now() - t0, "ms", "error" in sky ? sky.error : { ok: sky.ok, worst: sky.worst.toFixed(3), pts: sky.points.map((q) => `${q.conform}/${q.plan}`).join(" "), note: sky.info.note });
// 切り欠きが無い場合との比較（切り欠きは空を広げるので計画建築物の天空率は上がるはず）
const skyRect = checkSkyFactor({ site: p.site, grid: p.grid, building: { ...b, notches: [] }, slope: 1.25, applyDist: 20, eave: lv.eave, maxHeight: lv.max, roadEdgeIndex: rd.edgeIndex, effWidth: rd.effWidth });
if (!("error" in sky) && !("error" in skyRect)) console.log("切り欠き無し worst", skyRect.worst.toFixed(3), "（切り欠きあり ≧ 無し:", sky.points.every((q, i) => q.plan >= skyRect.points[i].plan), "）");
const t1 = Date.now();
const sh = checkShadow(p, 0.5);
console.log("日影", Date.now() - t1, "ms", "error" in sh ? sh.error : { target: sh.target, note: sh.targetNote, band5: sh.band5.max.toFixed(2), band10: sh.band10.max.toFixed(2), ok: sh.ok });
// 立面の輪郭（寄棟: 底辺側から見ると台形）
const sil = elevationSilhouette(b, "S", 8);
console.log("底辺側の輪郭", sil.map((q) => `${q.m.toFixed(1)}:${q.z.toFixed(2)}`).join(" "));
const silW = elevationSilhouette(b, "W", 8);
console.log("左側の輪郭", silW.map((q) => `${q.m.toFixed(1)}:${q.z.toFixed(2)}`).join(" "));
