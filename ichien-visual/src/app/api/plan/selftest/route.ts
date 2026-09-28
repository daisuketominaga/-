import { NextResponse } from "next/server";
import { lessonProject3, lessonProject2 } from "@/lib/sample";
import { roadFaceOf } from "@/lib/geometry";
import type { Project } from "@/lib/types";
import { generatePlan } from "@/lib/planGen";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * 参考プラン生成の自己テスト: 教材の建物で「参考プランを作る」を実行し、
 * 910mm モジュール・重なり・はみ出し・道路側の玄関/ガレージ・水回りの寸法を機械的に検査する。
 * GET /api/plan/selftest?case=3&parking=builtin1
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("case") ?? "3";
  const parking = url.searchParams.get("parking") ?? "builtin1";
  const project: Project = caseId === "2" ? lessonProject2() : lessonProject3();
  // 部屋を空にして全提案させる
  const p = { ...project, floors: project.floors.map((f) => ({ ...f, rooms: [], fixtures: [] })) };
  const roadFace = roadFaceOf(p.site, p.building) ?? "S";
  const t0 = Date.now();
  let json: Awaited<ReturnType<typeof generatePlan>>;
  try {
    json = await generatePlan({ mode: "generate", instruction: "", project: { building: p.building, floors: p.floors, site: { areaOverride: p.site.areaOverride, coverageRatio: p.site.coverageRatio, farRatio: p.site.farRatio } }, level: 1, fixed: [], options: { parking, roadFace, roadClearance: 1.0 } });
  } catch (e) {
    console.error("plan selftest failed", (e as Error).message, Date.now() - t0, "ms");
    return NextResponse.json({ error: (e as Error).message, ms: Date.now() - t0 }, { status: 500 });
  }
  console.log("plan selftest generated in", Date.now() - t0, "ms", "issues:", json.issues.length, "repaired:", json.repaired);
  // 外から取りにくいときのために、結果をログにも出す
  console.log("plan selftest result", JSON.stringify({ issues: json.issues, notes: json.notes, floors: json.floors.map((f) => ({ level: f.level, rooms: f.rooms.map((r) => `${r.name}(${r.type}) ${r.x},${r.y} ${r.w}×${r.d}${r.dir ? " " + r.dir : ""}${r.vanity ? " v" + r.vanity : ""}${r.bathSize ? " b" + r.bathSize : ""}`) })) }));
  const b = p.building;
  const floors = json.floors;
  const issues = json.issues;
  const bath = floors.flatMap((f) => f.rooms).find((r) => r.type === "bath");
  const wash = floors.flatMap((f) => f.rooms).find((r) => r.type === "washroom");
  // 生成に 1 分以上かかるので、結果を CDN に 30 分キャッシュして 2 回目の呼び出しで受け取れるようにする（?run=任意 で作り直し）
  return NextResponse.json({
    case: caseId, parking, roadFace, ms: Date.now() - t0, building: { w: b.w, d: b.d, notches: b.notches },
    ok: issues.length === 0, issues, repaired: json.repaired, notes: json.notes,
    bath: bath ? { w: bath.w, d: bath.d, bathSize: bath.bathSize } : null, washroom: wash ? { w: wash.w, d: wash.d, vanity: wash.vanity } : null,
    floors: floors.map((f) => ({ level: f.level, rooms: f.rooms.map((r) => `${r.name}(${r.type}) ${r.x},${r.y} ${r.w}×${r.d}`) })),
    usage: json.usage,
  }, { headers: { "Cache-Control": "public, s-maxage=1800, max-age=0" } });
}
