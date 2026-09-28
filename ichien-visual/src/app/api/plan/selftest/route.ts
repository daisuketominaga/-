import { NextResponse } from "next/server";
import { lessonProject3, lessonProject2 } from "@/lib/sample";
import { roadFaceOf, insideFootprint } from "@/lib/geometry";
import type { Project, Room } from "@/lib/types";
import { generatePlan } from "@/lib/planGen";

export const maxDuration = 120;
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const b = p.building;
  const floors = json.floors as unknown as { level: number; rooms: Room[] }[];
  const isMod = (v: number) => Math.abs(v / 0.91 - Math.round(v / 0.91)) < 1e-6;
  const halfOk = (r: Room) => ["hall", "toilet", "washroom", "closet", "storage", "stairs", "entrance"].includes(r.type);
  const issues: string[] = [];
  const overlaps = (a: Room, c: Room) => a.x + a.w > c.x + 1e-6 && c.x + c.w > a.x + 1e-6 && a.y + a.d > c.y + 1e-6 && c.y + c.d > a.y + 1e-6;
  for (const f of floors) {
    for (const r of f.rooms) {
      if (![r.x, r.y, r.w, r.d].every(isMod) && !halfOk(r)) issues.push(`${f.level}F ${r.name}: 910mm の倍数でない (${r.x},${r.y},${r.w},${r.d})`);
      if (r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > b.w + 1e-6 || r.y + r.d > b.d + 1e-6) issues.push(`${f.level}F ${r.name}: はみ出し`);
      // 切り欠きの中に入っていないか（部屋の中心で判定）
      if (!insideFootprint(b, r.x + r.w / 2, r.y + r.d / 2)) issues.push(`${f.level}F ${r.name}: 切り欠きにかかる`);
      if (r.type === "bath" && !(r.w >= 1.36 && r.d >= 1.36)) issues.push(`${f.level}F 浴室が小さい ${r.w}×${r.d}`);
    }
    for (let i = 0; i < f.rooms.length; i++) for (let j = i + 1; j < f.rooms.length; j++) if (f.rooms[i].type !== "balcony" && f.rooms[j].type !== "balcony" && overlaps(f.rooms[i], f.rooms[j])) issues.push(`${f.level}F ${f.rooms[i].name} と ${f.rooms[j].name} が重なる`);
    const covered = f.rooms.filter((r) => r.type !== "balcony").reduce((s, r) => s + r.w * r.d, 0);
    const fpArea = b.w * b.d - (b.notches ?? []).reduce((s, n) => s + n.w * n.d, 0);
    if (covered < fpArea - 0.5) issues.push(`${f.level}F 隙間 ${(fpArea - covered).toFixed(2)}㎡`);
  }
  const f1 = floors.find((f) => f.level === 1);
  const touches = (r: Room) => (roadFace === "S" ? r.y < 1e-6 : roadFace === "N" ? r.y + r.d > b.d - 1e-6 : roadFace === "W" ? r.x < 1e-6 : r.x + r.w > b.w - 1e-6);
  const ent = f1?.rooms.find((r) => r.type === "entrance");
  if (!ent) issues.push("1F に玄関が無い"); else if (!touches(ent)) issues.push("玄関が道路側の面に接していない");
  const gar = f1?.rooms.find((r) => r.type === "garage");
  if (parking.startsWith("builtin")) { if (!gar) issues.push("ビルトインガレージが無い"); else if (!touches(gar)) issues.push("ガレージが道路側に接していない"); else if (Math.max(gar.w, gar.d) < 5.4) issues.push(`ガレージの奥行が足りない ${gar.w}×${gar.d}`); }
  const bath = floors.flatMap((f) => f.rooms).find((r) => r.type === "bath");
  const wash = floors.flatMap((f) => f.rooms).find((r) => r.type === "washroom");
  return NextResponse.json({
    case: caseId, parking, roadFace, ms: Date.now() - t0, building: { w: b.w, d: b.d, notches: b.notches },
    ok: issues.length === 0, issues, notes: json.notes,
    bath: bath ? { w: bath.w, d: bath.d, bathSize: bath.bathSize } : null, washroom: wash ? { w: wash.w, d: wash.d, vanity: wash.vanity } : null,
    floors: floors.map((f) => ({ level: f.level, rooms: f.rooms.map((r) => `${r.name}(${r.type}) ${r.x},${r.y} ${r.w}×${r.d}`) })),
    usage: json.usage,
  });
}
