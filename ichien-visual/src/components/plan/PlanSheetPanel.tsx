"use client";

import { useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { downloadSvgAsJpeg, downloadText } from "@/lib/store";
import { planSheetLayout } from "@/lib/planSheet";
import { checkFurniture, FURNITURE } from "@/lib/furniture";
import { PlanSheet } from "./PlanSheet";

/** 図面出力: 全階を A4 横 1 枚に並べ、JPEG・SVG・印刷（PDF）で出す。成果物は JPEG が標準 */
export default function PlanSheetPanel({ project }: { project: Project }) {
  const ref = useRef<SVGSVGElement>(null);
  const [furniture, setFurniture] = useState(true);
  const layout = useMemo(() => planSheetLayout(project, { furniture }), [project, furniture]);
  const issues = useMemo(() => layout.cells.flatMap((c) => checkFurniture(project.building, c.floor.rooms, c.floor.fixtures ?? [], c.furniture).map((s) => `${c.level}階: ${s}`)), [layout, project.building]);
  const skipped = layout.cells.flatMap((c) => c.skipped.map((s) => `${c.level}階 ${s.room}: ${FURNITURE[s.kind]?.label ?? s.kind}`));

  const print = () => {
    const svg = ref.current;
    if (!svg) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${project.name} 間取り図</title><style>@page{size:A4 landscape;margin:8mm}html,body{margin:0;background:#fff}svg{width:100%;height:auto;display:block}</style></head><body>${svg.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1"><input type="checkbox" checked={furniture} onChange={(e) => setFurniture(e.target.checked)} />家具（配置イメージ）を描く</label>
        <span className="flex-1" />
        <button className="btn-ghost" onClick={() => ref.current && downloadSvgAsJpeg(ref.current, `${project.name}_間取り図.jpg`, 3)}>JPEG</button>
        <button className="btn-ghost" onClick={() => ref.current && downloadText(`${project.name}_間取り図.svg`, new XMLSerializer().serializeToString(ref.current), "image/svg+xml")}>SVG</button>
        <button className="btn-primary" onClick={print}>印刷／PDFに保存</button>
      </div>
      <div className="w-full overflow-auto rounded border border-slate-200 bg-slate-50 p-2 [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-[1123px] [&>svg]:shadow">
        <PlanSheet ref={ref} project={project} furniture={furniture} />
      </div>
      {(issues.length > 0 || skipped.length > 0) && (
        <div className="rounded bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
          {issues.length > 0 && <div><b>自動検査で見つかった重なり（{issues.length}件）:</b> {issues.join("／")}</div>}
          {skipped.length > 0 && <div><b>入らなかったので置かなかった家具:</b> {skipped.join("／")}</div>}
        </div>
      )}
      <p className="text-[11px] text-slate-500">注記（寸法は壁芯・家具は配置イメージ・参考プラン）は自動で入ります。壁厚は左の「壁厚（図示用）」で変えられます。家具の位置を固定したいときは左の「家具を保存」を押してください。</p>
    </div>
  );
}
