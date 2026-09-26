"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Project } from "@/lib/types";
import { TSUBO_M2 } from "@/lib/types";
import type { ProjectMeta } from "@/lib/store";
import { readProject } from "@/lib/store";
import { footprintArea, polygonArea, round } from "@/lib/geometry";
import { levels, checkLimits3D, rulesOf } from "@/lib/heightLimits";
import { estimateCost, totalFloorArea } from "@/lib/cost";
import CostPanel from "./CostPanel";

type Props = { project: Project; setProject: (u: (p: Project) => Project) => void; list: ProjectMeta[]; currentId: string };

/** 複数案の比較（同じ敷地の 2階建て案／3階建て案／L字案 など）と、今の案の概算費用 */
export default function Compare({ project, setProject, list, currentId }: Props) {
  const [ids, setIds] = useState<string[]>([currentId]);
  const rows = useMemo(() => {
    const picked = ids.map((id) => ({ id, p: id === currentId ? project : readProject(id) })).filter((x): x is { id: string; p: Project } => !!x.p);
    return picked.map(({ id, p }) => {
      const b = p.building;
      const lv = levels(b);
      const siteArea = p.site.areaOverride ?? polygonArea(p.site.points);
      const fp = footprintArea(b);
      const total = totalFloorArea(p);
      const lims = checkLimits3D(p);
      const over = lims.filter((l) => l.over > 0.001).map((l) => l.name);
      const r = rulesOf(p);
      const cost = estimateCost(p);
      return {
        id,
        name: p.name,
        siteArea,
        fp,
        cov: (fp / siteArea) * 100,
        covLimit: p.site.coverageRatio + (p.site.cornerLot ? 10 : 0),
        total,
        far: (total / siteArea) * 100,
        farLimit: p.site.farRatio,
        floors: b.floors,
        roof: b.roof,
        max: lv.max,
        over,
        sky: r.skyEnabled,
        cost,
        notches: (b.notches ?? []).length,
      };
    });
  }, [ids, project, currentId]);

  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 4 ? cur : [...cur, id]));
  const roofName: Record<string, string> = { flat: "陸屋根", shed: "片流れ", gable: "切妻", hip: "寄棟" };
  const man = (v: number | null) => (v === null ? "―" : `${Math.round(v).toLocaleString()}`);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-3">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">比べる案を選ぶ（最大4つ）</h3>
          <p className="text-[11px] text-slate-500">同じ敷地で「複製」して階数や形を変えた物件を並べて比べます。今開いている案は常に含まれます。</p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {list.map((m) => (
              <label key={m.id} className={`flex items-center gap-2 rounded px-1 py-0.5 text-xs ${m.id === currentId ? "bg-brand-50" : ""}`}>
                <input type="checkbox" checked={ids.includes(m.id)} disabled={m.id === currentId} onChange={() => toggle(m.id)} />
                <span className="truncate">{m.name || "（名前なし）"}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">今の案の概算費用・収支</h3>
          <CostPanel project={project} setProject={setProject} />
        </div>
      </aside>
      <section className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[11px] text-slate-500">
            <tr>
              <th className="px-2 py-1">項目</th>
              {rows.map((r) => <th key={r.id} className={`px-2 py-1 ${r.id === currentId ? "text-brand-700" : ""}`}>{r.name}{r.id === currentId ? "（今の案）" : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {([
              ["敷地面積", (r) => `${round(r.siteArea, 2)}㎡（${round(r.siteArea / TSUBO_M2, 2)}坪）`],
              ["階数・屋根", (r) => `${r.floors}階・${roofName[r.roof] ?? r.roof}${r.notches ? `・切り欠き${r.notches}` : ""}`],
              ["建築面積／建ぺい率", (r) => <span className={r.cov > r.covLimit + 1e-9 ? "text-red-600" : ""}>{round(r.fp, 2)}㎡／{round(r.cov, 1)}%（上限 {r.covLimit}%）</span>],
              ["延床面積／容積率", (r) => <span className={r.far > r.farLimit + 1e-9 ? "text-red-600" : ""}>{round(r.total, 2)}㎡（{round(r.total / TSUBO_M2, 2)}坪）／{round(r.far, 1)}%（指定 {r.farLimit}%）</span>],
              ["最高高さ", (r) => `${Math.round(r.max * 1000).toLocaleString()}mm`],
              ["斜線・高さ（3D判定）", (r) => (r.over.length ? <span className="text-red-600">超過: {r.over.join("、")}{r.sky ? "（天空率は各画面で確認）" : ""}</span> : <span className="text-emerald-700">すべて内側</span>)],
              ["建築費（万円）", (r) => man(r.cost.build)],
              ["総額（万円）", (r) => man(r.cost.total)],
              ["粗利（万円）", (r) => (r.cost.grossProfit === null ? "―" : <span className={r.cost.grossProfit < 0 ? "text-red-600" : "text-emerald-700"}>{man(r.cost.grossProfit)}（{r.cost.grossMargin!.toFixed(1)}%）</span>)],
              ["表面利回り", (r) => (r.cost.grossYield === null ? "―" : `${r.cost.grossYield.toFixed(2)}%`)],
            ] as [string, (r: (typeof rows)[number]) => ReactNode][]).map(([label, f]) => (
              <tr key={label} className="border-t border-slate-100 align-top">
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{label}</td>
                {rows.map((r) => <td key={r.id} className="px-2 py-1.5">{f(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-500">法規の判定は各案の設定（用途地域・高度地区など）に基づく参考値です。費用は各案に入力した単価による概算です。</p>
      </section>
    </div>
  );
}
