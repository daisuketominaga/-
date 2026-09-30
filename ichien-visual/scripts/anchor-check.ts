import { lessonProject4 } from "../src/lib/sample";
import { effectiveSite, insetPolygon } from "../src/lib/geometry";
import { baseFrame, toLocal } from "../src/lib/grid";
const p = lessonProject4();
const site = effectiveSite(p.site);
const f = baseFrame(site, 0);
const inner = insetPolygon(site.points, 0.6);
const innerLoc = inner.map((q) => toLocal(f, q));
console.log("innerLoc", innerLoc.map((q) => [q.x.toFixed(3), q.y.toFixed(3)]));
const extentAt = (axis: "u" | "v", at: number): [number, number] | null => {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < innerLoc.length; k++) {
    const a = innerLoc[k], c = innerLoc[(k + 1) % innerLoc.length];
    const a1 = axis === "v" ? a.y : a.x, c1 = axis === "v" ? c.y : c.x;
    const a2 = axis === "v" ? a.x : a.y, c2 = axis === "v" ? c.x : c.y;
    if ((a1 <= at && c1 >= at) || (c1 <= at && a1 >= at)) {
      if (Math.abs(c1 - a1) < 1e-9) { lo = Math.min(lo, a2, c2); hi = Math.max(hi, a2, c2); continue; }
      const t = (at - a1) / (c1 - a1);
      const x = a2 + (c2 - a2) * t;
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : null;
};
for (const v of [0.6, 2.0, 5.0, 8.0, 8.8, 8.9]) console.log("v", v, extentAt("v", v));
for (const u of [0.6, 1.0, 1.82, 2.73, 7.0]) console.log("u", u, extentAt("u", u));
