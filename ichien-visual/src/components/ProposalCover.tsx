"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { TSUBO_M2 } from "@/lib/types";
import { footprintArea, polygonArea, round } from "@/lib/geometry";
import { levels, rulesOf } from "@/lib/heightLimits";
import { ZONE_PRESETS, KODO_PRESETS } from "@/lib/heightPresets";
import { totalFloorArea } from "@/lib/cost";
import { surveyOf } from "@/lib/survey";

type Props = { project: Project; setProject: (u: (p: Project) => Project) => void };

export const COMPANY = {
  name: "株式会社イチエン不動産",
  ceo: "代表取締役 伊波 翼",
  director: "取締役 富永 大介",
};

/** 提案書に渡す「事実」だけを文章にする（AIの下書き用。ここに無いことは書かせない） */
export function proposalFacts(project: Project): string {
  const b = project.building;
  const lv = levels(b);
  const r = rulesOf(project);
  const zone = ZONE_PRESETS.find((z) => z.id === r.zoneId)?.name;
  const kodo = KODO_PRESETS.find((k) => k.id === r.kodoPresetId)?.name ?? r.kodoNote;
  const siteArea = project.site.areaOverride ?? polygonArea(project.site.points);
  const total = totalFloorArea(project);
  const roads = project.site.edges.filter((e) => e.road).map((e) => `${e.roadLabel ?? "道路"} 幅員${e.roadWidth ?? "?"}m`);
  const rooms = project.floors.map((f) => `${f.level}階: ${f.rooms.map((x) => x.name).join("・")}`);
  const survey = surveyOf(project).filter((i) => i.status === "ok" && i.value).map((i) => `${i.label}: ${i.value}`);
  const roofName: Record<string, string> = { flat: "陸屋根", shed: "片流れ", gable: "切妻", hip: "寄棟" };
  return [
    `物件名: ${project.name}`,
    project.address ? `所在: ${project.address}` : "",
    `敷地面積: ${round(siteArea, 2)}㎡（${round(siteArea / TSUBO_M2, 2)}坪）`,
    roads.length ? `接道: ${roads.join("、")}` : "",
    zone ? `用途地域: ${zone}（建ぺい率 ${project.site.coverageRatio}%・容積率 ${project.site.farRatio}%）` : "",
    kodo ? `高度地区: ${kodo}` : "",
    `参考プラン: ${b.structureLabel}、${roofName[b.roof] ?? b.roof}、建築面積 ${round(footprintArea(b), 2)}㎡、延床 ${round(total, 2)}㎡（${round(total / TSUBO_M2, 2)}坪）、最高高さ ${round(lv.max, 2)}m`,
    ...rooms,
    ...survey,
  ]
    .filter(Boolean)
    .join("\n");
}

/** 提案書の表紙: 会社名・担当者・キャッチコピー・説明文（AI下書きあり） */
export default function ProposalCover({ project, setProject }: Props) {
  const [busy, setBusy] = useState(false);
  const [cautions, setCautions] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const draft = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts: proposalFacts(project) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "作れませんでした");
      setProject((p) => ({ ...p, catchCopy: j.catchCopy || p.catchCopy, description: j.description || p.description }));
      setCautions(j.cautions ?? []);
      setMsg("下書きを入れました。事実と違う所が無いか読んで直してください。");
    } catch (e) {
      setMsg("エラー: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const siteArea = project.site.areaOverride ?? polygonArea(project.site.points);
  const total = totalFloorArea(project);
  const cover = project.photos?.find((p) => p.kind === "exterior") ?? project.photos?.[0];

  return (
    <>
      <div className="card space-y-2 print:hidden">
        <h3 className="text-sm font-semibold">提案書の表紙（お客様向け文章）</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col text-xs"><span className="text-slate-500">担当者</span><input className="field" value={project.staff ?? ""} placeholder="例: 富永 大介" onChange={(e) => setProject((p) => ({ ...p, staff: e.target.value }))} /></label>
          <label className="flex flex-col text-xs"><span className="text-slate-500">所在（表示用）</span><input className="field" value={project.address} onChange={(e) => setProject((p) => ({ ...p, address: e.target.value }))} /></label>
          <label className="flex flex-col text-xs md:col-span-2"><span className="text-slate-500">キャッチコピー（30字以内）</span><input className="field" value={project.catchCopy} onChange={(e) => setProject((p) => ({ ...p, catchCopy: e.target.value }))} /></label>
          <label className="flex flex-col text-xs md:col-span-2"><span className="text-slate-500">物件説明文（200〜300字）</span><textarea className="field" rows={5} value={project.description ?? ""} onChange={(e) => setProject((p) => ({ ...p, description: e.target.value }))} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" disabled={busy} onClick={draft}>{busy ? "作成中…" : "AIに下書きを頼む（入力済みの事実だけを使います）"}</button>
          {msg && <span className={`text-xs ${msg.startsWith("エラー") ? "text-red-600" : "text-emerald-700"}`}>{msg}</span>}
        </div>
        {cautions.length > 0 && <ul className="list-disc pl-5 text-[11px] text-amber-800">{cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>}
        <p className="text-[11px] text-slate-500">お客様に渡す前に、不動産の表示に関する公正競争規約（断定表現・優良誤認）と事実関係を必ず確認してください。</p>
      </div>

      <section className="print-page card">
        <div className="flex min-h-[520px] flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2">
              <div className="text-lg font-bold tracking-wide">{COMPANY.name}</div>
              <div className="text-xs text-slate-500">物件ご提案資料　{dateStr}</div>
            </div>
            <h1 className="mt-8 text-3xl font-bold leading-snug">{project.name}</h1>
            {project.address && <div className="mt-1 text-sm text-slate-600">{project.address}</div>}
            {project.catchCopy && <div className="mt-6 text-xl font-semibold text-brand-700">{project.catchCopy}</div>}
            <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
              <div>
                {project.description && <p className="whitespace-pre-wrap text-sm leading-relaxed">{project.description}</p>}
                <table className="mt-4 text-sm">
                  <tbody>
                    <tr><td className="pr-4 text-slate-500">敷地面積</td><td>{round(siteArea, 2)}㎡（{round(siteArea / TSUBO_M2, 2)}坪）</td></tr>
                    <tr><td className="pr-4 text-slate-500">参考プラン</td><td>{project.building.structureLabel}　延床 {round(total, 2)}㎡（{round(total / TSUBO_M2, 2)}坪）</td></tr>
                    {project.site.edges.filter((e) => e.road).map((e) => <tr key={e.index}><td className="pr-4 text-slate-500">接道</td><td>{e.roadLabel ?? "道路"}　幅員 {e.roadWidth ?? "?"}m</td></tr>)}
                  </tbody>
                </table>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cover && <img src={cover.dataUrl} alt="" className="aspect-[4/3] w-full rounded object-cover" />}
            </div>
          </div>
          <div className="mt-8 flex items-end justify-between border-t border-slate-300 pt-2 text-xs text-slate-600">
            <div>
              <div className="font-semibold">{COMPANY.name}</div>
              <div>{COMPANY.ceo}　／　{COMPANY.director}</div>
              {project.staff && <div>担当: {project.staff}</div>}
            </div>
            <div className="max-w-md text-right text-[10px] leading-relaxed text-slate-500">本資料の図面・面積・法規の判定は参考です。建築には別途設計・建築確認が必要で、内容を保証するものではありません。</div>
          </div>
        </div>
      </section>
    </>
  );
}
