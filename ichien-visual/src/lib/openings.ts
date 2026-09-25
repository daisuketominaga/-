import type { Project, Opening, Face, FixtureKind } from "./types";

/** 間取り図の建具から立面図の開口を作る。外壁に置かれた建具だけが対象 */
const HEIGHTS: Partial<Record<FixtureKind, { height: number; sill: number; kind: Opening["kind"] }>> = {
  window: { height: 1.17, sill: 0.9, kind: "window" }, // 腰窓 16511
  window_terrace: { height: 2.03, sill: 0, kind: "window" }, // 掃き出し 16520
  window_small: { height: 0.77, sill: 1.3, kind: "window" },
  door_entrance: { height: 2.33, sill: 0, kind: "door" }, // ジエスタ2 H2330
  door_parent_child: { height: 2.33, sill: 0, kind: "door" },
  sliding_double: { height: 2.03, sill: 0, kind: "window" },
  sliding_single: { height: 2.03, sill: 0, kind: "window" },
  door_single: { height: 2.0, sill: 0, kind: "door" },
  folding: { height: 2.0, sill: 0, kind: "door" },
  opening: { height: 2.2, sill: 0, kind: "garage" },
};

export function derivedOpenings(project: Project): Opening[] {
  const b = project.building;
  const eps = 1e-6;
  const out: Opening[] = [];
  for (const f of project.floors) {
    for (const fx of f.fixtures ?? []) {
      const spec = HEIGHTS[fx.kind];
      if (!spec) continue;
      let face: Face | null = null;
      let offset = 0;
      if (fx.along === "h" && Math.abs(fx.y) < eps) {
        face = "S"; // 底辺側を外から見ると左が x=0
        offset = fx.x;
      } else if (fx.along === "h" && Math.abs(fx.y - b.d) < eps) {
        face = "N"; // 奥側を外から見ると左が x=w
        offset = b.w - fx.x - fx.width;
      } else if (fx.along === "v" && Math.abs(fx.x) < eps) {
        face = "W"; // 左側を外から見ると左が y=d
        offset = b.d - fx.y - fx.width;
      } else if (fx.along === "v" && Math.abs(fx.x - b.w) < eps) {
        face = "E"; // 右側を外から見ると左が y=0
        offset = fx.y;
      }
      if (!face) continue;
      out.push({ id: "fx:" + fx.id, face, floor: f.level, offset: +offset.toFixed(3), width: fx.width, height: spec.height, sill: spec.sill, kind: spec.kind });
    }
  }
  return out;
}

export const isDerived = (o: Opening) => o.id.startsWith("fx:");
