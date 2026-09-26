import type { CostInput, Project } from "./types";
import { TSUBO_M2 } from "./types";

export type CostResult = {
  totalFloorM2: number;
  totalFloorTsubo: number;
  build: number | null;
  demolition: number;
  exterior: number;
  extra: number;
  subtotal: number | null;
  misc: number | null;
  land: number;
  total: number | null;
  /** 売価 − 総額（万円） */
  grossProfit: number | null;
  grossMargin: number | null;
  /** 表面利回り（%） = 年間賃料 / 総額 */
  grossYield: number | null;
  lines: { label: string; value: number | null; note?: string }[];
};

export function totalFloorArea(project: Project) {
  return project.floors.reduce((a, f) => a + f.rooms.filter((r) => r.type !== "balcony").reduce((s, r) => s + r.w * r.d, 0), 0);
}

/** 概算（万円）。単価が空なら建築費は null（計算しない）。すべて利用者が入れた単価による */
export function estimateCost(project: Project, c: CostInput | undefined = project.cost): CostResult {
  const m2 = totalFloorArea(project);
  const tsubo = m2 / TSUBO_M2;
  const build = c?.tsuboPrice ? Math.round(tsubo * c.tsuboPrice) : null;
  const demolition = c?.demolition ?? 0;
  const exterior = c?.exterior ?? 0;
  const extra = c?.extra ?? 0;
  const subtotal = build === null ? null : build + demolition + exterior + extra;
  const misc = subtotal === null ? null : Math.round((subtotal + (c?.landPrice ?? 0)) * ((c?.miscRate ?? 0) / 100));
  const land = c?.landPrice ?? 0;
  const total = subtotal === null ? null : subtotal + misc! + land;
  const grossProfit = total !== null && c?.salePrice ? c.salePrice - total : null;
  const grossMargin = grossProfit !== null && c?.salePrice ? (grossProfit / c.salePrice) * 100 : null;
  const grossYield = total !== null && total > 0 && c?.monthlyRent ? ((c.monthlyRent * 12) / total) * 100 : null;
  return {
    totalFloorM2: m2,
    totalFloorTsubo: tsubo,
    build,
    demolition,
    exterior,
    extra,
    subtotal,
    misc,
    land,
    total,
    grossProfit,
    grossMargin,
    grossYield,
    lines: [
      { label: `建築費（延床 ${tsubo.toFixed(2)} 坪 × ${c?.tsuboPrice ?? "―"} 万円/坪）`, value: build },
      { label: "解体費", value: demolition },
      { label: "外構・造成・擁壁", value: exterior },
      { label: "設計・申請・地盤改良・引込など", value: extra },
      { label: `諸費用（${c?.miscRate ?? 0}%）`, value: misc },
      { label: "土地価格", value: land },
      { label: "総額", value: total },
    ],
  };
}
