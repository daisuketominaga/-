import type { Project, SurveyItem } from "./types";
import { KODO_PRESETS, ZONE_PRESETS } from "./heightPresets";

/** 役所調査の標準項目。順番は調査の流れ（都市計画 → 道路 → 規制 → インフラ → 現地） */
export const SURVEY_TEMPLATE: { key: string; label: string; hint: string }[] = [
  { key: "zone", label: "用途地域・建ぺい率・容積率", hint: "都市計画図（市のWeb地図）。角地緩和・前面道路幅員による容積率の制限も" },
  { key: "kodo", label: "高度地区", hint: "種別と式。北側道路の緩和の扱い" },
  { key: "shadow", label: "日影規制", hint: "対象・測定面・時間（都市計画図の日影欄）" },
  { key: "fire", label: "防火・準防火地域／22条区域", hint: "外壁・開口部の仕様に影響" },
  { key: "district", label: "地区計画・建築協定・景観・緑化", hint: "壁面後退、最低敷地面積、緑化率、色彩など" },
  { key: "road", label: "前面道路（種別・幅員・セットバック）", hint: "42条の何項何号か。2項道路なら中心線から2mの後退。私道なら通行掘削承諾" },
  { key: "plannedRoad", label: "都市計画道路・道路拡幅予定", hint: "計画線にかかると53条許可が必要" },
  { key: "hazard", label: "土砂災害・急傾斜・宅造規制・浸水想定", hint: "ハザードマップ、宅造規制区域、崖条例（がけ条例）" },
  { key: "culture", label: "埋蔵文化財包蔵地", hint: "該当なら93条届出・試掘" },
  { key: "water", label: "上水道（引込管の口径・前面配管）", hint: "水道局の配管図。口径13→20mmの増径費用" },
  { key: "sewer", label: "下水道（公共下水・浄化槽）", hint: "下水道台帳。受益者負担金の有無" },
  { key: "gas", label: "都市ガス／プロパン", hint: "ガス会社の配管図" },
  { key: "boundary", label: "境界確定・越境・私道負担", hint: "確定測量図、境界標の有無、越境物の覚書" },
  { key: "existing", label: "既存建物・擁壁・地盤", hint: "解体要否、擁壁の検査済証、地盤調査" },
  { key: "other", label: "その他（自治会、ゴミ置き場、電柱など）", hint: "" },
];

export function defaultSurvey(): SurveyItem[] {
  return SURVEY_TEMPLATE.map((t) => ({ key: t.key, label: t.label, value: "", status: "unchecked", source: "", checkedAt: "", note: "" }));
}

/** 保存済みの項目に、テンプレートの新しい項目を足す（順番はテンプレート優先） */
export function surveyOf(project: Project): SurveyItem[] {
  const saved = project.survey ?? [];
  const out = SURVEY_TEMPLATE.map((t) => saved.find((s) => s.key === t.key) ?? { key: t.key, label: t.label, value: "", status: "unchecked" as const, source: "", checkedAt: "", note: "" });
  for (const s of saved) if (!out.some((o) => o.key === s.key)) out.push(s);
  return out;
}

/** アプリの設定から、その項目の「今の設定値」を文章にする（調査内容と突き合わせるため） */
export function appValueFor(project: Project, key: string): string {
  const r = project.site.heightRules;
  switch (key) {
    case "zone": {
      const z = ZONE_PRESETS.find((x) => x.id === r?.zoneId);
      return `${z?.name ?? "用途地域 未選択"}、建ぺい率 ${project.site.coverageRatio}%${project.site.cornerLot ? "（角地＋10）" : ""}、容積率 ${project.site.farRatio}%`;
    }
    case "kodo": {
      if (!r?.kodoEnabled) return "高度地区 未設定";
      const k = KODO_PRESETS.find((x) => x.id === r.kodoPresetId);
      const segs = (r.kodoSegs ?? []).map((s) => `${s.base}m＋${s.slope}×L`).join(" / ");
      return `${k?.name ?? r.kodoNote ?? "手入力"}${segs ? `（${segs}）` : ""}${r.kodoAbsolute ? ` 絶対高さ ${r.kodoAbsolute}m` : ""}`;
    }
    case "shadow":
      return r?.shadowEnabled ? `対象 ${r.shadowTarget === "eave7" ? "軒高7m超/3階以上" : "高さ10m超"}、測定面 ${r.shadowPlaneH}m、${r.shadowHours5}h/${r.shadowHours10}h` : "日影 未設定";
    case "fire":
      return project.site.fireproofException ? "耐火構造の離れ緩和 ON" : "（アプリでは防火地域の判定は未対応）";
    case "road": {
      const roads = project.site.edges.filter((e) => e.road);
      return roads.length ? roads.map((e) => `${e.roadLabel ?? "道路"} 幅員 ${e.roadWidth ?? "?"}m`).join("、") : "道路の辺 未設定";
    }
    case "boundary": {
      const n = project.site.points.length;
      return `境界点 ${n} 点、敷地面積 ${project.site.areaOverride ?? "（座標計算）"}㎡`;
    }
    default:
      return "";
  }
}

export function surveyProgress(items: SurveyItem[]) {
  const done = items.filter((i) => i.status !== "unchecked").length;
  return { done, total: items.length, ng: items.filter((i) => i.status === "ng").length };
}
