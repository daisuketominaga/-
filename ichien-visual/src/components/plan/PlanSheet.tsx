/**
 * 図面出力シート（A4 横 1 枚）。表示専用。
 * 画面では PlanSheetPanel が、CLI では lib/planSvg.ts がこの部品を描く。
 */
import { forwardRef } from "react";
import type { Project } from "@/lib/types";
import { northScreenDeg } from "@/lib/geometry";
import { planSheetLayout, type PlanSheetOptions } from "@/lib/planSheet";
import { FloorSvg, FixturesSvg, BuildingDims, NorthMark, FurnitureSvg } from "./PlanParts";

export type PlanSheetProps = PlanSheetOptions & { project: Project; /** 単独の SVG ファイルとして出す（xmlns を付ける） */ standalone?: boolean };

const FONT = "'Hiragino Sans','Noto Sans JP','IPAPGothic',sans-serif";

export const PlanSheet = forwardRef<SVGSVGElement, PlanSheetProps>(function PlanSheet({ project, standalone, ...opts }, ref) {
  const L = planSheetLayout(project, opts);
  const flip = !!project.grid?.flip;
  const tableX = L.margin + 10;
  const notesX = L.margin + 560;
  const rowH = 14;
  const colRows = Math.ceil(L.table.length / 2);
  const colW = 265;
  return (
    <svg ref={ref} xmlns={standalone ? "http://www.w3.org/2000/svg" : undefined} viewBox={`0 0 ${L.W} ${L.H}`} width={L.W} height={L.H} style={{ background: "#fff", fontFamily: FONT }} fontFamily={FONT}>
      <rect width={L.W} height={L.H} fill="#fff" />
      {/* 外枠 */}
      <rect x={L.margin - 10} y={L.margin - 10} width={L.W - (L.margin - 10) * 2} height={L.H - (L.margin - 10) * 2} fill="none" stroke="#222" strokeWidth={1.2} />
      {/* 表題 */}
      <text x={L.margin} y={L.margin + 22} fontSize={20} fontWeight={700} fill="#111">{L.title}</text>
      <text x={L.margin} y={L.margin + 40} fontSize={11} fill="#555">{L.subtitle}</text>
      <line x1={L.margin - 10} y1={L.margin + 48} x2={L.W - L.margin + 10} y2={L.margin + 48} stroke="#222" strokeWidth={0.8} />
      {/* 各階 */}
      {L.cells.map((c, i) => (
        <g key={c.level}>
          {i > 0 && <line x1={c.x - 6} y1={c.y} x2={c.x - 6} y2={c.y + c.h} stroke="#ccc" strokeWidth={0.6} strokeDasharray="4 4" />}
          <text x={c.x} y={c.y + 17} fontSize={13} fontWeight={700} fill="#111">{c.title}</text>
          <NorthMark x={c.x + c.w - 26} y={c.y + 20} deg={northScreenDeg(project, "plan")} />
          <FloorSvg floor={c.floor} project={project} ox={c.ox} oy={c.oy} px={c.px} flip={flip} compact={c.compact} level={c.level} overlay={<FurnitureSvg items={c.furniture} project={project} ox={c.ox} oy={c.oy} px={c.px} flip={flip} />} />
          <FixturesSvg fixtures={c.floor.fixtures ?? []} project={project} ox={c.ox} oy={c.oy} px={c.px} flip={flip} compact={c.compact} showLabels={!c.compact} />
          <BuildingDims rooms={c.floor.rooms} ox={c.ox} oy={c.oy} px={c.px} w={project.building.w} d={project.building.d} flip={flip} compact={c.compact} />
        </g>
      ))}
      {/* 下段: 面積表・注記・発行者 */}
      <line x1={L.margin - 10} y1={L.bandY} x2={L.W - L.margin + 10} y2={L.bandY} stroke="#222" strokeWidth={0.8} />
      <g fontSize={10} fill="#222">
        {L.table.map(([k, v], j) => {
          const col = Math.floor(j / colRows), row = j % colRows;
          const x = tableX + col * colW, y = L.bandY + 16 + row * rowH;
          return (
            <g key={k + j}>
              <text x={x} y={y} fill="#555">{k}</text>
              <text x={x + 100} y={y} fontWeight={600}>{v}</text>
              <line x1={x} y1={y + 4} x2={x + colW - 15} y2={y + 4} stroke="#ddd" strokeWidth={0.5} />
            </g>
          );
        })}
      </g>
      <g fontSize={10} fill="#333">
        <text x={notesX} y={L.bandY + 16} fontWeight={700}>注記</text>
        {L.notes.map((t, j) => (
          <text key={j} x={notesX} y={L.bandY + 32 + j * rowH}>{`${j + 1}. ${t}`}</text>
        ))}
        <text x={notesX} y={L.bandY + 32 + L.notes.length * rowH + 4} fill="#666" fontSize={9}>
          凡例: 太線＝外壁、細線＝内壁、青二重線＝窓、扇形＝開き戸の開く範囲、UP/DN＝階段の上り下り、薄い線の図形＝家具（配置イメージ）
        </text>
      </g>
      <text x={L.W - L.margin} y={L.H - L.margin + 2} fontSize={10} textAnchor="end" fill="#333">{L.footer}</text>
    </svg>
  );
});

export default PlanSheet;
