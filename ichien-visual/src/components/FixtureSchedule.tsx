"use client";

import type { Project } from "@/lib/types";
import { fixtureSchedule, scheduleCsv } from "@/lib/fixtureSpec";
import { downloadText } from "@/lib/store";

/** 建具表（見積・図面指示用）。間取り図の建具から自動で作る */
export default function FixtureSchedule({ project, compact }: { project: Project; compact?: boolean }) {
  const rows = fixtureSchedule(project);
  if (!rows.length) return <div className="text-xs text-slate-400">建具がまだ置かれていません。間取り図で壁の上に建具を置くと、ここに建具表が出ます。</div>;
  const ext = rows.filter((r) => r.exterior);
  const int = rows.filter((r) => !r.exterior);
  const Table = ({ title, list }: { title: string; list: typeof rows }) => (
    <div>
      <div className="mb-1 text-xs font-semibold">{title}（{list.reduce((a, r) => a + r.count, 0)} か所）</div>
      <table className={`w-full ${compact ? "text-[10px]" : "text-xs"}`}>
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 pr-2">記号</th><th className="pr-2">階</th><th className="pr-2">種類</th><th className="pr-2 text-right">幅</th><th className="pr-2 text-right">高さ</th><th className="pr-2 text-right">取付高</th><th className="pr-2 text-right">数量</th><th className="pr-2">参考品番</th><th>仕様</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.symbol + r.level} className="border-b border-dashed border-slate-200">
              <td className="py-1 pr-2 font-medium">{r.symbol}</td>
              <td className="pr-2">{r.level}F</td>
              <td className="pr-2">{r.label}</td>
              <td className="pr-2 text-right tabular-nums">{r.widthMm.toLocaleString()}</td>
              <td className="pr-2 text-right tabular-nums">{r.heightMm.toLocaleString()}</td>
              <td className="pr-2 text-right tabular-nums">{r.sillMm.toLocaleString()}</td>
              <td className="pr-2 text-right tabular-nums">{r.count}</td>
              <td className={`pr-2 ${r.guessed ? "text-amber-700" : ""}`}>{r.ref}</td>
              <td className="text-slate-600">{r.spec}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">記号は間取り図の建具から自動採番（同じ種類・同じ幅は同じ記号）。</div>
          <button className="btn-ghost text-xs" onClick={() => downloadText(`${project.name}_建具表.csv`, scheduleCsv(rows), "text/csv")}>CSV（Excel用）</button>
        </div>
      )}
      <Table title="外部建具（サッシ・玄関）" list={ext} />
      <Table title="内部建具" list={int} />
      <p className="text-[10px] leading-relaxed text-slate-500">
        高さ・取付高さは標準値（腰窓 H1170／腰高 900、掃き出し H2030、玄関 H2330、室内ドア H2023）。【推測】の品番は一般的な寸法として仮置きしたもので、見積・発注前にメーカーカタログで確認してください。防火・準防火地域では道路側・隣地側の開口部に防火設備が必要になる場合があります。
      </p>
    </div>
  );
}
