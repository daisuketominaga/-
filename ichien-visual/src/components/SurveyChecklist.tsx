"use client";

import type { Project, SurveyItem, SurveyStatus } from "@/lib/types";
import { SURVEY_TEMPLATE, surveyOf, appValueFor, surveyProgress } from "@/lib/survey";
import ZoningImport from "./ZoningImport";

type Props = { project: Project; setProject: (u: (p: Project) => Project) => void; readOnly?: boolean };

const STATUS_LABEL: Record<SurveyStatus, string> = { unchecked: "未確認", ok: "確認済み", ng: "要注意", na: "該当なし" };
const STATUS_CLASS: Record<SurveyStatus, string> = { unchecked: "bg-amber-100 text-amber-800", ok: "bg-emerald-100 text-emerald-800", ng: "bg-red-100 text-red-700", na: "bg-slate-100 text-slate-500" };

/** 役所調査のチェックリスト。項目ごとに 状態・内容・出典・確認日・メモ を残す */
export default function SurveyChecklist({ project, setProject, readOnly }: Props) {
  const items = surveyOf(project);
  const prog = surveyProgress(items);
  const update = (key: string, patch: Partial<SurveyItem>) =>
    setProject((p) => ({ ...p, survey: surveyOf(p).map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">役所調査チェックリスト</h3>
              <p className="text-[11px] text-slate-500">重要事項説明の下準備として、調べた内容・出典・確認日を物件ごとに残します。{prog.done}/{prog.total} 項目 確認済み{prog.ng ? `、要注意 ${prog.ng}` : ""}</p>
            </div>
          </div>
          <ZoningImport project={project} setProject={setProject} compact />
        </div>
      )}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] text-slate-500">
            <tr>
              <th className="px-2 py-1.5 w-52">項目</th>
              <th className="px-2 py-1.5 w-24">状態</th>
              <th className="px-2 py-1.5">調べた内容</th>
              <th className="px-2 py-1.5 w-44">出典（URL・窓口）</th>
              <th className="px-2 py-1.5 w-28">確認日</th>
              <th className="px-2 py-1.5 w-40">メモ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const hint = SURVEY_TEMPLATE.find((t) => t.key === it.key)?.hint;
              const app = appValueFor(project, it.key);
              return (
                <tr key={it.key} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{it.label}</div>
                    {hint && !readOnly && <div className="text-[10px] text-slate-400">{hint}</div>}
                    {app && <div className="mt-0.5 text-[10px] text-blue-700">アプリの設定: {app}</div>}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className={`rounded px-1.5 py-0.5 ${STATUS_CLASS[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                    ) : (
                      <select className={`field px-1 py-0.5 ${STATUS_CLASS[it.status]}`} value={it.status} onChange={(e) => update(it.key, { status: e.target.value as SurveyStatus, checkedAt: it.checkedAt || (e.target.value === "unchecked" ? "" : today) })}>
                        {(Object.keys(STATUS_LABEL) as SurveyStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{readOnly ? <div className="whitespace-pre-wrap">{it.value}</div> : <textarea className="field min-h-[2.2rem] px-1 py-0.5" rows={2} value={it.value} onChange={(e) => update(it.key, { value: e.target.value })} />}</td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      it.source.startsWith("http") ? <a className="break-all text-blue-700 underline" href={it.source} target="_blank" rel="noreferrer">{it.source}</a> : it.source
                    ) : (
                      <input className="field px-1 py-0.5" value={it.source} placeholder="URL や 建築指導課 ○○さん" onChange={(e) => update(it.key, { source: e.target.value })} />
                    )}
                  </td>
                  <td className="px-2 py-1.5">{readOnly ? it.checkedAt : <input type="date" className="field px-1 py-0.5" value={it.checkedAt} onChange={(e) => update(it.key, { checkedAt: e.target.value })} />}</td>
                  <td className="px-2 py-1.5">{readOnly ? it.note : <input className="field px-1 py-0.5" value={it.note} onChange={(e) => update(it.key, { note: e.target.value })} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && <p className="text-[11px] text-slate-500">この表は参考です。重要事項説明書の作成時は、必ず一次情報（役所の窓口・公式Web地図・台帳）で再確認してください。</p>}
    </div>
  );
}
