// 教材1（保土ケ谷区法泉3丁目）を設計事務所の数値と突き合わせる
//   npx tsx scripts/lesson1-check.ts
import { lessonProject1 } from "../src/lib/sample";
import { levels, checkLimits3D, roadInfos, roadLevelOffset } from "../src/lib/heightLimits";
import { polygonArea, roofRise, roofHeightAt } from "../src/lib/geometry";
import { checkSkyFactor } from "../src/lib/skyFactor";

const p = lessonProject1();
const b = p.building;
const lv = levels(b);
const area = polygonArea(p.site.points);
console.log("敷地面積 座標計算", area.toFixed(2), "図面 123.59");
console.log("建物", b.w, "x", b.d, "回転", b.rotDeg, "位置", b.x.toFixed(3), b.y.toFixed(3));
console.log("1FL", lv.fl[0].toFixed(3), "(図面 0.581)", "2FL", lv.fl[1].toFixed(3), "(図面 3.381)", "軒高", lv.eave.toFixed(3), "(図面 6.040)", "最高", lv.max.toFixed(3), "(図面 7.798)", "rise", roofRise(b).toFixed(3));
const bArea = b.w * b.d;
console.log("建ぺい率", ((bArea / 123.59) * 100).toFixed(2), "% (図面 39.20 / 建築面積 48.44)  ours 建築面積", bArea.toFixed(2));
const total = 46.02 + 44.3;
console.log("容積率", ((total / 123.59) * 100).toFixed(2), "% (図面 73.09)");
console.log("道路", roadInfos(p), "高低差起点", roadLevelOffset(p));
// 北側軒先の高さ（母屋下がり）
console.log("北軒先 z", roofHeightAt(b, b.w / 2, -0.25, lv.eave, roofRise(b), lv.max).toFixed(3), "(図面 5.392)", "北壁 z", roofHeightAt(b, b.w / 2, 0, lv.eave, roofRise(b), lv.max).toFixed(3));
console.log("西軒先(北角) z", roofHeightAt(b, -0.25, 0, lv.eave, roofRise(b), lv.max).toFixed(3), "(図面 5.938)");
for (const l of checkLimits3D(p, 0.05)) console.log(l.key, l.name, "over", l.over.toFixed(3), l.worst ? `worst x${l.worst.x.toFixed(2)} y${l.worst.y.toFixed(2)} z${l.worst.z.toFixed(3)} limit${l.worst.limit.toFixed(3)} margin ${(l.worst.limit - l.worst.z).toFixed(3)}` : "");
const rd = roadInfos(p)[0];
const sky = checkSkyFactor({ site: p.site, grid: p.grid, building: b, slope: 1.25, applyDist: 20, eave: lv.eave, maxHeight: lv.max, roadEdgeIndex: rd.edgeIndex, effWidth: rd.effWidth, zOff: roadLevelOffset(p) });
console.log("天空率", "error" in sky ? sky.error : { ok: sky.ok, worst: sky.worst, pts: sky.points.length, back: sky.info.back });
