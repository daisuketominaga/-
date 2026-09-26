"use client";

import { useRef } from "react";
import type { Project } from "@/lib/types";
import { TSUBO_M2 } from "@/lib/types";
import { round, roadFaceOf, footprintArea } from "@/lib/geometry";
import SitePlan from "./SitePlan";
import BuildableGrid from "./BuildableGrid";
import { AllFloorsSvg } from "./FloorPlan";
import { AllElevationsSvg, elevationTitle } from "./Elevation";
import { verdictRows, useSky, useShadow } from "./HeightCheck";
import FixtureSchedule from "./FixtureSchedule";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

/** 全図面を1つの印刷用ページに並べる。ブラウザの印刷から「PDFに保存」で書き出す */
export default function PrintView({ project, setProject }: Props) {
  const floorsRef = useRef<SVGSVGElement>(null);
  const elevRef = useRef<SVGSVGElement>(null);
  const b = project.building;
  const floorArea = (f: Project["floors"][number]) => f.rooms.filter((r) => r.type !== "balcony").reduce((a, r) => a + r.w * r.d, 0);
  const balconyArea = (f: Project["floors"][number]) => f.rooms.filter((r) => r.type === "balcony").reduce((a, r) => a + r.w * r.d, 0);
  const total = project.floors.reduce((a, f) => a + floorArea(f), 0);
  const bedrooms = project.floors.flatMap((f) => f.rooms).filter((r) => r.type === "bedroom" || r.type === "japanese").length;
  const hasLdk = project.floors.flatMap((f) => f.rooms).some((r) => r.type === "ldk");
  const extras = Array.from(new Set(project.floors.flatMap((f) => f.rooms).filter((r) => r.type === "study" || r.type === "garage").map((r) => r.name)));
  const summary = `${bedrooms}${hasLdk ? "LDK" : "K"}${extras.length ? "＋" + extras.join("＋") : ""}`;
  const siteArea = project.site.areaOverride ?? 0;
  const sky = useSky(project);
  const shadow = useShadow(project);
  const rows = verdictRows(project, sky, shadow);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="text-sm text-slate-600">
          敷地図・配置図・間取り図・立面図を1つにまとめました。印刷画面で「PDFに保存」を選ぶとPDFになります（A4横、各図1ページ）。
        </div>
        <button className="btn-primary" onClick={() => window.print()}>印刷／PDFに保存</button>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: #fff !important; }
          .print-page { break-after: page; page-break-after: always; }
          .print-page:last-child { break-after: auto; page-break-after: auto; }
          .print-hide { display: none !important; }
          aside { display: none !important; }
          .card { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>

      <section className="print-page card">
        <h2 className="mb-2 text-lg font-bold">{project.name}　敷地図</h2>
        <SitePlan project={project} setProject={setProject} readOnly />
      </section>

      <section className="print-page card">
        <h2 className="mb-2 text-lg font-bold">{project.name}　配置図（建築可能範囲・910mmグリッド）</h2>
        <BuildableGrid project={project} setProject={setProject} readOnly />
      </section>

      <section className="print-page card">
        <h2 className="mb-2 text-lg font-bold">{project.name}　建物参考プラン（{b.structureLabel}）</h2>
        <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
          <span>間取り {summary}</span>
          {siteArea > 0 && <span>敷地面積 {round(siteArea, 2)}㎡（{round(siteArea / TSUBO_M2, 2)}坪）</span>}
          <span>建築面積 {round(footprintArea(b), 2)}㎡</span>
          {project.floors.map((f) => (
            <span key={f.level}>{f.level}階 {round(floorArea(f), 2)}㎡{balconyArea(f) ? `（＋バルコニー ${round(balconyArea(f), 2)}㎡）` : ""}</span>
          ))}
          <span>延床面積 {round(total, 2)}㎡（{round(total / TSUBO_M2, 2)}坪）</span>
        </div>
        <div className="w-full overflow-auto [&>svg]:h-auto [&>svg]:w-full">
          <AllFloorsSvg ref={floorsRef} project={project} summary={summary} total={total} floorArea={floorArea} balconyArea={balconyArea} />
        </div>
      </section>

      <section className="print-page card">
        <h2 className="mb-2 text-lg font-bold">{project.name}　立面図</h2>
        <div className="w-full overflow-auto [&>svg]:h-auto [&>svg]:w-full">
          <AllElevationsSvg ref={elevRef} project={project} title={elevationTitle(project)} roadFace={roadFaceOf(project.site, b)} />
        </div>
      </section>

      <section className="print-page card">
        <h2 className="mb-2 text-lg font-bold">{project.name}　建具表</h2>
        <FixtureSchedule project={project} compact />
      </section>

      <section className="print-page card">
        <h2 className="mb-2 text-lg font-bold">{project.name}　法規チェック（参考）</h2>
        <table className="w-full text-xs">
          <tbody>
            {rows.map((row) => (
              <tr key={row.item} className="border-b border-dashed border-slate-200 align-top">
                <td className="py-1 pr-2 whitespace-nowrap font-medium">{row.item}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{row.status === "ok" ? "確認済み" : row.status === "ng" ? "超過" : row.status === "na" ? "対象外" : "未確認"}</td>
                <td className="py-1 text-slate-600">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-500">※このチェックは参考です。用途地域・高度地区・日影規制などの値は役所または確認検査機関で確認した数値で判断してください。天空率は確認申請ソフトとの照合が必要です。</p>
      </section>

      <p className="text-[11px] text-slate-400 print:block">
        ※参考図です。面積は壁芯計算の概算で、建築には別途設計・建築確認が必要です。境界からの離れは民法234条（50cm）を基本にしています。
      </p>
    </div>
  );
}
