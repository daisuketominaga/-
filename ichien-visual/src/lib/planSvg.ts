/**
 * 図面出力シートを SVG 文字列として返す純関数（Node / CLI / サーバー用）。
 *   planSheetSvg(project) → "<svg …>…</svg>"
 * 画面と同じ React 部品（components/plan/PlanSheet）を文字列化するだけなので、画面・PNG・印刷・CLI の絵は常に同じ。
 * ブラウザのクライアント側コードからは呼ばない（react-dom/server はサーバー／Node 専用）。画面では PlanSheetPanel が同じ部品を直接描く。
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Project } from "./types";
import type { PlanSheetOptions } from "./planSheet";
import { PlanSheet } from "@/components/plan/PlanSheet";

export { planSheetLayout, PLAN_NOTES, A4_LANDSCAPE, summaryOf } from "./planSheet";
export type { PlanSheetOptions } from "./planSheet";

export function planSheetSvg(project: Project, opts: PlanSheetOptions = {}): string {
  const body = renderToStaticMarkup(createElement(PlanSheet, { project, standalone: true, ...opts }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
