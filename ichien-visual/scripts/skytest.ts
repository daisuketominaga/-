import { sampleProject } from "../src/lib/sample";
import { checkSkyFactor } from "../src/lib/skyFactor";
import { levels } from "../src/lib/heightLimits";

const p = sampleProject();
const lv = levels(p.building);
console.log("sample building", p.building.w, p.building.d, "eave", lv.eave.toFixed(2), "max", lv.max.toFixed(2), "grid", p.grid);
const run = (label: string, patch: Partial<typeof p.building>, slope = 1.25, applyDist = 20) => {
  const b = { ...p.building, ...patch };
  const l = levels(b);
  const t0 = Date.now();
  const r = checkSkyFactor({ site: p.site, grid: p.grid, building: b, slope, applyDist, eave: l.eave, maxHeight: l.max });
  const dt = Date.now() - t0;
  if ("error" in r) { console.log(label, "ERROR", r.error); return; }
  console.log(label, `max=${l.max.toFixed(2)}`, "ok=", r.ok, "worst=", r.worst.toFixed(4), `${dt}ms`, r.points.map((q) => `${q.conform.toFixed(3)}/${q.plan.toFixed(3)}`).join(" "), r.info.note.join(";"));
};
run("3F 片流れ（現状）", {});
run("2F 陸屋根 低め", { floors: 2, roof: "flat" });
run("1F", { floors: 1, roof: "flat" });
run("4F 陸屋根", { floors: 4, roof: "flat", floorHeights: [2.4, 2.4, 2.4, 2.4] });
run("3F 勾配1.5", {}, 1.5);
// 精度チェック: 分割数を変えても結果が安定するか
const l = levels(p.building);
const a = checkSkyFactor({ site: p.site, grid: p.grid, building: p.building, slope: 1.25, applyDist: 20, eave: l.eave, maxHeight: l.max, nAz: 360, nAlt: 90 });
const bb = checkSkyFactor({ site: p.site, grid: p.grid, building: p.building, slope: 1.25, applyDist: 20, eave: l.eave, maxHeight: l.max, nAz: 1440, nAlt: 360 });
if (!("error" in a) && !("error" in bb)) console.log("resolution 360x90 vs 1440x360:", a.points.map((q) => q.plan.toFixed(3)).join(","), "|", bb.points.map((q) => q.plan.toFixed(3)).join(","));
