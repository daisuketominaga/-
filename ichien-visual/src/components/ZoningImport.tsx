"use client";

import { useState } from "react";
import type { Project, SurveyItem } from "@/lib/types";
import { DEFAULT_HEIGHT_RULES } from "@/lib/types";
import { fileToDataUrl, pdfToDataUrl, shrink } from "@/lib/imageInput";
import { KODO_PRESETS, ZONE_PRESETS } from "@/lib/heightPresets";
import { rulesFromZone, rulesFromKodo } from "@/lib/heightLimits";
import { surveyOf } from "@/lib/survey";
import type { ZoningResult } from "@/lib/zoningRead";

type Props = { project: Project; setProject: (u: (p: Project) => Project) => void; compact?: boolean };

/** 用途地域名 → ZONE_PRESETS の id */
function zoneIdOf(name: string | null): string {
  if (!name) return "";
  const n = name.replace(/[一二三１２３]/g, (c) => ({ 一: "1", 二: "2", 三: "3", "１": "1", "２": "2", "３": "3" })[c] ?? c);
  if (n.includes("1種低層") || n.includes("第1種低層")) return "1low";
  if (n.includes("2種低層")) return "2low";
  if (n.includes("田園")) return "denen";
  if (n.includes("1種中高層")) return "1mid";
  if (n.includes("2種中高層")) return "2mid";
  if (n.includes("1種住居")) return "1res";
  if (n.includes("2種住居")) return "2res";
  if (n.includes("準住居")) return "quasi";
  if (n.includes("近隣商業")) return "ncom";
  if (n.includes("商業")) return "com";
  if (n.includes("準工業")) return "qind";
  if (n.includes("工業専用")) return "indx";
  if (n.includes("工業")) return "ind";
  return "";
}

/** 高度地区名（と自治体） → KODO_PRESETS の id */
function kodoIdOf(kodo: string | null, city: string | null): string {
  if (!kodo) return "";
  const m = kodo.replace(/[１２３４５６７]/g, (c) => String("１２３４５６７".indexOf(c) + 1)).match(/第?\s*([1-7])\s*種/);
  const n = m?.[1];
  if (!n) return "";
  const cityKey = city?.includes("横浜") ? "yokohama" : city?.includes("川崎") ? "kawasaki" : city?.includes("鎌倉") ? "kamakura" : city?.includes("東京") || city?.includes("区") ? "tokyo" : "yokohama";
  const id = `${cityKey}-${n}`;
  return KODO_PRESETS.some((k) => k.id === id) ? id : "";
}

/** 都市計画図の画面を貼ると、用途地域・建ぺい容積・高度地区・日影・防火を読み取って設定と調査表に入れる */
export default function ZoningImport({ project, setProject, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [res, setRes] = useState<ZoningResult | null>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setMsg(null);
    setRes(null);
    try {
      let dataUrl = file.type === "application/pdf" ? await pdfToDataUrl(file) : await fileToDataUrl(file);
      dataUrl = await shrink(dataUrl, 2000);
      const r = await fetch("/api/zoning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "読み取りに失敗しました");
      setRes(j);
    } catch (e) {
      setMsg("エラー: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!res) return;
    const today = new Date().toISOString().slice(0, 10);
    setProject((p) => {
      let rules = { ...DEFAULT_HEIGHT_RULES, ...(p.site.heightRules ?? {}) };
      const site = { ...p.site };
      const zid = zoneIdOf(res.zone);
      if (res.coverage !== null) site.coverageRatio = res.coverage;
      if (res.far !== null) site.farRatio = res.far;
      if (zid) rules = rulesFromZone(zid, site.farRatio, rules);
      const kid = kodoIdOf(res.kodo, res.kodoCity);
      if (kid) rules = rulesFromKodo(kid, rules);
      else if (res.kodo) rules = { ...rules, kodoEnabled: true, kodoPresetId: "", kodoNote: `${res.kodoCity ?? ""} ${res.kodo}（式は未入力・原文で確認）` };
      if (res.absoluteHeight !== null && (!rules.absoluteMax || res.absoluteHeight < rules.absoluteMax)) rules.absoluteMax = res.absoluteHeight;
      if (res.shadow && (res.shadow.hours5 !== null || res.shadow.plane !== null)) {
        rules = { ...rules, shadowEnabled: true, shadowTarget: res.shadow.target?.includes("7") ? "eave7" : "h10", shadowPlaneH: res.shadow.plane ?? rules.shadowPlaneH, shadowHours5: res.shadow.hours5 ?? rules.shadowHours5, shadowHours10: res.shadow.hours10 ?? rules.shadowHours10 };
      }
      site.heightRules = rules;
      // 調査表にも書き込む（出典: 都市計画図の画像）
      const src = "都市計画図（画像をAIで読み取り・要目視確認）";
      const items = surveyOf({ ...p, site });
      const put = (key: string, value: string) => {
        const it = items.find((i) => i.key === key)!;
        it.value = value;
        it.status = "ok";
        it.source = it.source || src;
        it.checkedAt = it.checkedAt || today;
      };
      const zoneName = ZONE_PRESETS.find((z) => z.id === zid)?.name ?? res.zone;
      if (zoneName || res.coverage !== null || res.far !== null) put("zone", `${zoneName ?? ""}${res.coverage !== null ? ` 建ぺい率 ${res.coverage}%` : ""}${res.far !== null ? ` 容積率 ${res.far}%` : ""}${res.minSite !== null ? ` 最低敷地 ${res.minSite}㎡` : ""}`.trim());
      if (res.kodo) put("kodo", `${res.kodoCity ?? ""} ${res.kodo}`.trim());
      if (res.shadow && (res.shadow.hours5 !== null || res.shadow.target)) put("shadow", `${res.shadow.target ?? ""} 測定面 ${res.shadow.plane ?? "?"}m ${res.shadow.hours5 ?? "?"}h/${res.shadow.hours10 ?? "?"}h`.trim());
      if (res.fire) put("fire", res.fire);
      if (res.others.length) {
        const d = items.find((i) => i.key === "district")!;
        d.value = [d.value, ...res.others].filter(Boolean).join("、");
        if (d.status === "unchecked") d.status = "ok";
        d.source = d.source || src;
        d.checkedAt = d.checkedAt || today;
      }
      const survey: SurveyItem[] = items;
      return { ...p, site, survey };
    });
    setMsg("設定と調査表に反映しました。数値は必ず元の画面と見比べてください。");
    setRes(null);
  };

  return (
    <div className={`space-y-1 rounded border border-dashed border-slate-300 p-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-slate-700">都市計画図の画面を貼って設定する（用途地域・建ぺい容積・高度地区・日影・防火）</div>
        <label className={`btn-ghost cursor-pointer whitespace-nowrap px-2 py-0.5 ${busy ? "opacity-50" : ""}`}>
          {busy ? "読み取り中…" : "画像/PDFを選ぶ"}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
        </label>
      </div>
      {msg && <div className={msg.startsWith("エラー") ? "text-red-600" : "text-emerald-700"}>{msg}</div>}
      {res && (
        <div className="space-y-1 rounded bg-emerald-50 p-2 text-emerald-900">
          {res.address && <div>地点: {res.address}</div>}
          <div>用途地域: {res.zone ?? "―"}　建ぺい率: {res.coverage ?? "―"}%　容積率: {res.far ?? "―"}%{res.minSite !== null ? `　最低敷地 ${res.minSite}㎡` : ""}{res.absoluteHeight !== null ? `　高さ ${res.absoluteHeight}m` : ""}</div>
          <div>高度地区: {res.kodo ?? "―"}{res.kodoCity ? `（${res.kodoCity}）` : ""}　防火: {res.fire ?? "―"}</div>
          <div>日影: {res.shadow ? `${res.shadow.target ?? "?"} 測定面 ${res.shadow.plane ?? "?"}m ${res.shadow.hours5 ?? "?"}h/${res.shadow.hours10 ?? "?"}h` : "―"}</div>
          {res.others.length > 0 && <div>その他: {res.others.join("、")}</div>}
          {res.notes && <div className="text-slate-600">{res.notes}</div>}
          <div className="flex gap-2">
            <button className="btn-primary px-2 py-0.5" onClick={apply}>この内容を設定と調査表に入れる</button>
            <button className="btn-ghost px-2 py-0.5" onClick={() => setRes(null)}>やめる</button>
          </div>
        </div>
      )}
    </div>
  );
}
