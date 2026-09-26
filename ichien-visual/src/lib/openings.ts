import type { Project, Opening, Face, FixtureKind } from "./types";
import { notchesOf, notchRect } from "./geometry";

/** 間取り図の建具から立面図の開口を作る。外壁に置かれた建具だけが対象 */
const HEIGHTS: Partial<
  Record<FixtureKind, { height: number; sill: number; kind: Opening["kind"] }>
> = {
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

/** 建具が外壁（切り欠きの内側の壁を含む）に付いていれば、その面と、面を外から見た左端からの位置を返す */
export function fixtureFace(
  b: Project["building"],
  fx: { x: number; y: number; along: "h" | "v"; width: number },
): { face: Face; offset: number } | null {
  const eps = 1e-6;
  let face: Face | null = null;
  let offset = 0;
  // 切り欠きの内側の壁も外壁。平行な面の立面に（引っ込んだ位置のまま）出す
  const ns = notchesOf(b).map((n) => ({ n, r: notchRect(b, n) }));
  const onS =
    Math.abs(fx.y) < eps ||
    ns.some(
      ({ n, r }) =>
        (n.corner === "SW" || n.corner === "SE") &&
        Math.abs(fx.y - r.y1) < eps &&
        fx.x >= r.x0 - eps &&
        fx.x + fx.width <= r.x1 + eps,
    );
  const onN =
    Math.abs(fx.y - b.d) < eps ||
    ns.some(
      ({ n, r }) =>
        (n.corner === "NW" || n.corner === "NE") &&
        Math.abs(fx.y - r.y0) < eps &&
        fx.x >= r.x0 - eps &&
        fx.x + fx.width <= r.x1 + eps,
    );
  const onW =
    Math.abs(fx.x) < eps ||
    ns.some(
      ({ n, r }) =>
        (n.corner === "SW" || n.corner === "NW") &&
        Math.abs(fx.x - r.x1) < eps &&
        fx.y >= r.y0 - eps &&
        fx.y + fx.width <= r.y1 + eps,
    );
  const onE =
    Math.abs(fx.x - b.w) < eps ||
    ns.some(
      ({ n, r }) =>
        (n.corner === "SE" || n.corner === "NE") &&
        Math.abs(fx.x - r.x0) < eps &&
        fx.y >= r.y0 - eps &&
        fx.y + fx.width <= r.y1 + eps,
    );
  if (fx.along === "h" && onS) {
    face = "S"; // 底辺側を外から見ると左が x=0
    offset = fx.x;
  } else if (fx.along === "h" && onN) {
    face = "N"; // 奥側を外から見ると左が x=w
    offset = b.w - fx.x - fx.width;
  } else if (fx.along === "v" && onW) {
    face = "W"; // 左側を外から見ると左が y=d
    offset = b.d - fx.y - fx.width;
  } else if (fx.along === "v" && onE) {
    face = "E"; // 右側を外から見ると左が y=0
    offset = fx.y;
  }
  return face ? { face, offset } : null;
}

export function derivedOpenings(project: Project): Opening[] {
  const b = project.building;
  const out: Opening[] = [];
  for (const f of project.floors) {
    for (const fx of f.fixtures ?? []) {
      const spec = HEIGHTS[fx.kind];
      if (!spec) continue;
      const ff = fixtureFace(b, fx);
      if (!ff) continue;
      out.push({
        id: "fx:" + fx.id,
        face: ff.face,
        floor: f.level,
        offset: +ff.offset.toFixed(3),
        width: fx.width,
        height: spec.height,
        sill: spec.sill,
        kind: spec.kind,
      });
    }
  }
  return out;
}

export const isDerived = (o: Opening) => o.id.startsWith("fx:");
