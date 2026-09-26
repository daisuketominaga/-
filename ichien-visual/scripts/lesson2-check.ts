// 教材2（戸塚区深谷町）を設計事務所の数値と突き合わせる:  npx tsx scripts/lesson2-check.ts
import { lessonProject2 } from "../src/lib/sample";
import { levels, checkLimits3D, roadInfos } from "../src/lib/heightLimits";
import { polygonArea, roofRise } from "../src/lib/geometry";
import { checkSkyFactor } from "../src/lib/skyFactor";
const p = lessonProject2();
const b = p.building;
const lv = levels(b);
console.log("敷地面積 座標計算", polygonArea(p.site.points).toFixed(2), "図面 110.50");
console.log("1FL", lv.fl[0].toFixed(3), "(0.581) 2FL", lv.fl[1].toFixed(3), "(3.381) 軒高", lv.eave.toFixed(3), "(6.100) 最高", lv.max.toFixed(3), "(8.261) rise", roofRise(b).toFixed(3));
console.log("建ぺい率(外接矩形)", ((b.w * b.d / 110.5) * 100).toFixed(2), "% (図面 49.17 / 建築面積 54.33)");
console.log("容積率", (((53.82 + 46.37) / 110.5) * 100).toFixed(2), "% (図面 90.67) 上限 4.5×0.4=180");
console.log("道路", roadInfos(p).map((r) => ({ w: r.width, eff: r.effWidth, back: r.back.toFixed(2), face: r.face })));
for (const l of checkLimits3D(p, 0.05)) console.log(l.key, l.name, "over", l.over.toFixed(3), l.worst ? `worst x${l.worst.x.toFixed(2)} y${l.worst.y.toFixed(2)} z${l.worst.z.toFixed(3)} limit${l.worst.limit.toFixed(3)} margin ${(l.worst.limit - l.worst.z).toFixed(3)}` : "");
const rd = roadInfos(p)[0];
const sky = checkSkyFactor({ site: p.site, grid: p.grid, building: b, slope: 1.25, applyDist: 20, eave: lv.eave, maxHeight: lv.max, roadEdgeIndex: rd.edgeIndex, effWidth: rd.effWidth, zOff: 0 });
console.log("天空率", "error" in sky ? sky.error : { ok: sky.ok, worst: sky.worst.toFixed(3), pts: sky.points.length });
