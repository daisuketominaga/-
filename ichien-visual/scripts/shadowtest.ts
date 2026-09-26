// 日影の計算テスト:  npx tsx scripts/shadowtest.ts
import { sampleProject } from "../src/lib/sample";
import { checkShadow } from "../src/lib/shadow";
import { levels } from "../src/lib/heightLimits";
import { footprintWorld } from "../src/lib/geometry";

const p = sampleProject();
p.site.heightRules = { ...(p.site.heightRules ?? {}), shadowEnabled: true, shadowTarget: "h10", shadowPlaneH: 4, shadowHours5: 4, shadowHours10: 2.5, latitude: 35.45 } as never;
p.building.floors = 3; p.building.floorHeights = [2.4, 2.4, 2.4]; p.building.roof = "flat"; p.building.eaveOverhang = 0;
p.site.northDeg = 0;
console.log("levels", levels(p.building));
const t0 = Date.now();
const r = checkShadow(p, 0.5);
if ("error" in r) { console.log(r.error); process.exit(1); }
console.log("ms", Date.now() - t0, "target", r.target, r.targetNote);
console.log("sun", r.sun);
console.log("band5", r.band5, "band10", r.band10, "samples", r.samples.length);
// 検算: 冬至・緯度35.45 の正午の太陽高度 = 90 − 35.45 − 23.44 = 31.11°
console.log("正午の高度 期待 31.11");
// 検算2: 北側に落ちる影の長さ。正午、高さ (max−4) の影長 = (max−4)/tan(31.11°)
const lv = levels(p.building);
console.log("正午の影長(北向き) 期待", ((lv.max - 4) / Math.tan((31.11 * Math.PI) / 180)).toFixed(2), "m");
const fp = footprintWorld(p.building);
const fpMaxY = Math.max(...fp.map((q) => q.y));
const maxY = Math.max(...r.samples.map((s) => s.y));
console.log("建物の北端 y", fpMaxY.toFixed(2), "影が届く最遠 y", maxY.toFixed(2), "→", (maxY - fpMaxY).toFixed(2), "m（正午 8.45m より朝夕の低い太陽で長くなる）");
// 北側直近（境界から5〜10m）の時間分布
console.log("band5 hours histogram", Object.entries(r.samples.filter((s) => s.band === 5).reduce((m, s) => { const k = Math.floor(s.h); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<number, number>)));
