"use client";

import { useEffect, useState } from "react";
import { useProject, downloadText } from "@/lib/store";
import type { Project } from "@/lib/types";
import PhotoBatch from "@/components/PhotoBatch";
import SitePlan from "@/components/SitePlan";
import FloorPlan from "@/components/FloorPlan";
import Elevation from "@/components/Elevation";
import BuildableGrid from "@/components/BuildableGrid";
import PrintView from "@/components/PrintView";

type Tab = "photo" | "site" | "grid" | "floor" | "elevation" | "print";

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "photo", label: "写真一括補正", short: "写真" },
  { id: "site", label: "敷地図", short: "敷地" },
  { id: "grid", label: "建築可能範囲", short: "配置" },
  { id: "floor", label: "間取り図", short: "間取り" },
  { id: "elevation", label: "立面図", short: "立面" },
  { id: "print", label: "印刷・PDF", short: "印刷" },
];

export default function Home() {
  const { project, setProject, replaceProject, list, currentId, switchTo, createProject, deleteProject } = useProject();
  const [tab, setTab] = useState<Tab>("site");

  useEffect(() => {
    try {
      const t = localStorage.getItem("ichien-visual-tab") as Tab | null;
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("ichien-visual-tab", tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  const importJson = (file: File) => {
    file.text().then((t) => {
      try {
        const p = JSON.parse(t) as Project;
        if (!p.site || !p.building) throw new Error("形式が違います");
        createProject("empty");
        // createProject の state 反映後に中身を置き換える
        setTimeout(() => replaceProject(p), 0);
      } catch (e) {
        alert("読み込めませんでした: " + (e as Error).message);
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight">イチエン物件ビジュアル工房</h1>
          <p className="text-xs text-slate-500">
            測量図 → 敷地図 → 910グリッドで建築可能範囲 → 間取り → 立面 → 印刷。現地写真は明るさを一括で統一。
          </p>
        </div>
        {project && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select className="field max-w-[200px]" value={currentId} onChange={(e) => switchTo(e.target.value)} title="物件を切り替え">
              {list.map((m) => (
                <option key={m.id} value={m.id}>{m.name || "（名前なし）"}</option>
              ))}
            </select>
            <input
              className="field max-w-[200px]"
              value={project.name}
              onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
              placeholder="物件名"
            />
            <button className="btn-ghost" onClick={() => createProject("empty")} title="白紙の物件を追加">＋新規</button>
            <button className="btn-ghost" onClick={() => createProject("copy")} title="今の物件を複製">複製</button>
            <button className="btn-ghost" onClick={() => createProject("sample")} title="サンプル（藤沢市鵠沼松が岡）を追加">サンプル</button>
            <button className="btn-ghost" onClick={() => createProject("lesson1")} title="教材1（保土ケ谷区法泉3丁目・設計図あり）を追加">教材1</button>
            <button
              className="btn-ghost text-red-600"
              disabled={list.length <= 1}
              onClick={() => {
                if (confirm(`「${project.name}」を削除しますか？元に戻せません。`)) deleteProject(currentId);
              }}
            >
              削除
            </button>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <button
              className="btn-ghost"
              onClick={() => downloadText(`${project.name || "project"}.ichien.json`, JSON.stringify(project, null, 2))}
            >
              ファイルに保存
            </button>
            <label className="btn-ghost cursor-pointer">
              ファイルから読込
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </label>
          </div>
        )}
      </header>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm border border-slate-200 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </nav>

      {!project ? (
        <div className="card text-sm text-slate-500">読み込み中…</div>
      ) : (
        <main>
          {tab === "photo" && <PhotoBatch />}
          {tab === "site" && <SitePlan project={project} setProject={setProject} />}
          {tab === "grid" && <BuildableGrid project={project} setProject={setProject} />}
          {tab === "floor" && <FloorPlan project={project} setProject={setProject} />}
          {tab === "elevation" && <Elevation project={project} setProject={setProject} />}
          {tab === "print" && <PrintView project={project} setProject={setProject} />}
        </main>
      )}

      <footer className="mt-8 text-[11px] leading-relaxed text-slate-400 print:hidden">
        図面は参考図です。面積は概算で、建築には別途設計・建築確認が必要です。境界からの離れは民法234条（50cm）を基本表示し、
        防火地域・準防火地域で外壁が耐火構造の場合（建築基準法65条）は切り替えで非表示にできます。物件データはこのブラウザの中に保存されます。
      </footer>
    </div>
  );
}
