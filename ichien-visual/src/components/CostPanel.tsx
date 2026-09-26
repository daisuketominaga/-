"use client";

import type { Project, CostInput } from "@/lib/types";
import { estimateCost } from "@/lib/cost";

type Props = { project: Project; setProject: (u: (p: Project) => Project) => void; readOnly?: boolean };

const man = (v: number | null) => (v === null ? "―" : `${Math.round(v).toLocaleString()} 万円`);

/** 概算費用・収支。単価はすべて利用者が入れる（アプリは計算だけ） */
export default function CostPanel({ project, setProject, readOnly }: Props) {
  const c: CostInput = project.cost ?? {};
  const r = estimateCost(project, c);
  const set = (patch: Partial<CostInput>) => setProject((p) => ({ ...p, cost: { ...(p.cost ?? {}), ...patch } }));
  const Num = ({ k, label, step = 1 }: { k: keyof CostInput; label: string; step?: number }) => (
    <label className="flex flex-col text-[11px]">
      <span className="text-slate-500">{label}</span>
      <input type="number" step={step} className="field px-1 py-0.5" value={(c[k] as number | undefined) ?? ""} placeholder="―" onChange={(e) => set({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Num k="tsuboPrice" label="建築費 坪単価（万円/坪）" step={1} />
          <Num k="demolition" label="解体費（万円）" step={10} />
          <Num k="exterior" label="外構・造成・擁壁（万円）" step={10} />
          <Num k="extra" label="設計・申請・地盤・引込（万円）" step={10} />
          <Num k="miscRate" label="諸費用（%）" step={0.5} />
          <Num k="landPrice" label="土地価格（万円）" step={10} />
          <Num k="salePrice" label="想定売価（万円）" step={10} />
          <Num k="monthlyRent" label="想定賃料（万円/月）" step={0.5} />
        </div>
      )}
      <table className="w-full text-xs">
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.label} className={`border-b border-dashed border-slate-200 ${l.label === "総額" ? "font-semibold" : ""}`}>
              <td className="py-0.5 pr-2">{l.label}</td>
              <td className="py-0.5 text-right tabular-nums">{man(l.value)}</td>
            </tr>
          ))}
          {r.grossProfit !== null && (
            <tr className="border-b border-dashed border-slate-200">
              <td className="py-0.5 pr-2">売価 − 総額（粗利）</td>
              <td className={`py-0.5 text-right tabular-nums ${r.grossProfit < 0 ? "text-red-600" : "text-emerald-700"}`}>{man(r.grossProfit)}（{r.grossMargin!.toFixed(1)}%）</td>
            </tr>
          )}
          {r.grossYield !== null && (
            <tr>
              <td className="py-0.5 pr-2">表面利回り（年間賃料 ÷ 総額）</td>
              <td className="py-0.5 text-right tabular-nums">{r.grossYield.toFixed(2)}%</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-500">延床 {r.totalFloorM2.toFixed(2)}㎡（{r.totalFloorTsubo.toFixed(2)}坪）。単価・金額はすべて入力値による概算で、税・時期・仕様で大きく変わります。見積は施工会社に取ってください。</p>
    </div>
  );
}
