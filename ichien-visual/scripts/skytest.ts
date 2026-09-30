import { sampleProject } from "../src/lib/sample";
import { checkSkyFactor } from "../src/lib/skyFactor";
import { levels } from "../src/lib/heightLimits";
import { baseFrame, toLocal } from "../src/lib/grid";

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
// 高低差緩和: 敷地が道路より 2m 高い → 起点 −1.5m
{ const l2 = levels(p.building); const r2 = checkSkyFactor({ site: p.site, grid: p.grid, building: p.building, slope: 1.25, applyDist: 20, eave: l2.eave, maxHeight: l2.max, zOff: -1.5 }); if (!("error" in r2)) console.log("高低差2m", "ok=", r2.ok, "worst=", r2.worst.toFixed(4)); }
// 精度チェック: 分割数を変えても結果が安定するか
const l = levels(p.building);
const a = checkSkyFactor({ site: p.site, grid: p.grid, building: p.building, slope: 1.25, applyDist: 20, eave: l.eave, maxHeight: l.max, nAz: 360, nAlt: 90 });
const bb = checkSkyFactor({ site: p.site, grid: p.grid, building: p.building, slope: 1.25, applyDist: 20, eave: l.eave, maxHeight: l.max, nAz: 1440, nAlt: 360 });
if (!("error" in a) && !("error" in bb)) console.log("resolution 360x90 vs 1440x360:", a.points.map((q) => q.plan.toFixed(3)).join(","), "|", bb.points.map((q) => q.plan.toFixed(3)).join(","));

// ===== 独立検算: 陸屋根の直方体1棟について、天空率を「方位角ごとの最大仰角」の閉じた式で積分して比べる =====
// 正射影の遮蔽面積 = ∫ sin²θmax(φ)/2 dφ。直方体（鉛直な壁）なら θmax(φ) = atan(h / r(φ))、r(φ) は算定位置から φ 方向に
// 見て直方体の平面（矩形）に入る最短距離。レイの多角形クリップとは別の式（矩形の辺との交点）で r を求める。
{
  const box = { ...p.building, roof: "flat" as const, floors: 3, floorHeights: [2.4, 2.4, 2.4], notches: [], eaveOverhang: 0 };
  const lb = levels(box);
  const res = checkSkyFactor({ site: p.site, grid: p.grid, building: box, slope: 1.25, applyDist: 20, eave: lb.eave, maxHeight: lb.max, nAz: 2880, nAlt: 720 });
  if ("error" in res) throw new Error(res.error);
  // 建物矩形の道路座標での4隅（skyFactor と同じ枠の取り方）
  const rf = baseFrame(p.site, p.site.edges.find((e) => e.road)!.index);
  const bf = baseFrame(p.site, p.grid.baseEdge);
  const W = (u: number, v: number) => ({ x: bf.a.x + u * bf.t.x + v * bf.n.x, y: bf.a.y + u * bf.t.y + v * bf.n.y });
  const corners = [W(p.grid.u, p.grid.v), W(p.grid.u + box.w, p.grid.v), W(p.grid.u + box.w, p.grid.v + box.d), W(p.grid.u, p.grid.v + box.d)].map((q) => toLocal(rf, q));
  const h = lb.max;
  const rayRect = (o: { x: number; y: number }, phi: number): number | null => {
    // 4辺との交点のうち最小の正の距離（凸なので最初に入る点）
    let best: number | null = null;
    const d = { x: Math.cos(phi), y: Math.sin(phi) };
    for (let i = 0; i < 4; i++) {
      const a = corners[i], c = corners[(i + 1) % 4];
      const ex = c.x - a.x, ey = c.y - a.y;
      const det = d.x * ey - d.y * ex;
      if (Math.abs(det) < 1e-12) continue;
      const s = ((a.x - o.x) * ey - (a.y - o.y) * ex) / det;
      const t = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / det;
      if (s > 1e-9 && t >= -1e-9 && t <= 1 + 1e-9 && (best === null || s < best)) best = s;
    }
    return best;
  };
  const N = 200000;
  const lines = res.points.map((pt) => {
    let blocked = 0;
    for (let i = 0; i < N; i++) {
      const phi = ((i + 0.5) / N) * 2 * Math.PI;
      const r = rayRect({ x: pt.u, y: pt.v }, phi);
      if (r === null) continue;
      const s2 = (h * h) / (h * h + r * r); // sin²θmax
      blocked += (s2 / 2) * ((2 * Math.PI) / N);
    }
    const exact = 1 - blocked / Math.PI;
    return `P${pt.index}: 数値積分 ${pt.plan.toFixed(3)}（切捨て前は非公開）／閉じた式 ${exact.toFixed(4)} 差 ${(Math.abs(pt.plan - exact) * 100).toFixed(2)}pt`;
  });
  console.log("独立検算（直方体・計画建築物）:\n  " + lines.join("\n  "));
}
