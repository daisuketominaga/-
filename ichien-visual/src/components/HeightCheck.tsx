"use client";

import { useMemo } from "react";
import type { Project, HeightRules } from "@/lib/types";
import { TSUBO_M2 } from "@/lib/types";
import { KODO_PRESETS, ZONE_PRESETS, ZONE_SOURCE } from "@/lib/heightPresets";
import { rulesOf, rulesFromZone, rulesFromKodo, checkLimits3D, levels, roadInfos, roadLevelOffset } from "@/lib/heightLimits";
import { checkSkyFactor, type SkyResult } from "@/lib/skyFactor";
import { polygonArea, round } from "@/lib/geometry";

type Props = {
  project: Project;
  setProject: (u: (p: Project) => Project) => void;
};

type Row = { item: string; status: "ok" | "ng" | "unknown" | "na"; detail: string };

/** 判定表（確認済み／超過／未確認）を作る。印刷画面でも使う */
export type SkyAll = { road: string; result: SkyResult | { error: string } }[];

export function verdictRows(project: Project, skyAll: SkyAll | null): Row[] {
  const r = rulesOf(project);
  const b = project.building;
  const lv = levels(b);
  const lims = checkLimits3D(project);
  const wp = (l: { worst: { x: number; y: number; z: number; limit: number } | null }) => (l.worst ? `（最も厳しい点: 建物座標 x${round(l.worst.x, 2)} y${round(l.worst.y, 2)}、高さ ${mm(l.worst.z)} vs 上限 ${mm(l.worst.limit)}）` : "");
  const rows: Row[] = [];
  const mm = (m: number) => Math.round(m * 1000).toLocaleString();
  const zone = ZONE_PRESETS.find((z) => z.id === r.zoneId);
  rows.push({ item: "用途地域", status: zone ? "ok" : "unknown", detail: zone ? `${zone.name}（道路斜線 ${r.roadSlope}、適用距離 ${r.roadApplyDist}m）` : "未選択。選ぶと勾配・適用距離・北側斜線・隣地斜線が自動で入ります" });

  // 建ぺい率・容積率
  const siteArea = project.site.areaOverride ?? polygonArea(project.site.points);
  const bArea = b.w * b.d;
  const cov = (bArea / siteArea) * 100;
  const covLimit = project.site.coverageRatio + (project.site.cornerLot ? 10 : 0);
  rows.push({ item: "建ぺい率", status: cov <= covLimit + 1e-9 ? "ok" : "ng", detail: `${round(cov, 1)}%（上限 ${covLimit}%${project.site.cornerLot ? "＝指定＋角地10%" : ""}）建築面積 ${round(bArea, 2)}㎡` });
  const total = project.floors.reduce((a, f) => a + f.rooms.filter((x) => x.type !== "balcony").reduce((s, x) => s + x.w * x.d, 0), 0);
  const farUse = (total / siteArea) * 100;
  // 法52条2項: 前面道路（2以上あれば最大幅員）が12m未満なら、幅員×0.4（住居系）／0.6（その他）が上限
  const roads = roadInfos(project);
  const roadWmax = roads.length ? Math.max(...roads.map((x) => x.width)) : null;
  const coef = zone ? (zone.residential ? 0.4 : 0.6) : 0.4;
  const farRoad = roadWmax !== null && roadWmax < 12 ? Math.round(roadWmax * coef * 100) : null;
  const farLimit = farRoad !== null ? Math.min(project.site.farRatio, farRoad) : project.site.farRatio;
  rows.push({ item: "容積率の上限", status: roadWmax === null ? "unknown" : zone ? "ok" : "unknown", detail: roadWmax === null ? "道路が未設定" : farRoad !== null ? `前面道路 ${roadWmax}m × ${coef}${zone ? "" : "（用途地域未選択のため住居系の 0.4 で仮計算）"} ＝ ${farRoad}% と指定 ${project.site.farRatio}% の小さい方 → ${farLimit}%（法52条2項）` : `前面道路 ${roadWmax}m は12m以上なので指定 ${project.site.farRatio}% のまま` });
  rows.push({ item: "容積率", status: total > 0 ? (farUse <= farLimit + 1e-9 ? "ok" : "ng") : "unknown", detail: total > 0 ? `${round(farUse, 1)}%（上限 ${farLimit}%）延床 ${round(total, 2)}㎡＝${round(total / TSUBO_M2, 2)}坪。上限いっぱいなら ${round((siteArea * farLimit) / 100, 2)}㎡ まで` : "間取りが無いので未計算" });

  const roadLims = lims.filter((l) => l.key.startsWith("road"));
  const roadOver = Math.max(0, ...roadLims.map((l) => l.over));
  const skyOkAll = skyAll && skyAll.length > 0 && skyAll.every((x) => !("error" in x.result) && x.result.ok);
  const skyErr = skyAll?.find((x) => "error" in x.result);
  if (roadOver > 0) {
    if (r.skyEnabled && skyAll && !skyErr) {
      rows.push({ item: "道路斜線", status: skyOkAll ? "ok" : "ng", detail: skyOkAll ? `斜線は最大 ${mm(roadOver)}mm 超えるが、天空率で適合（全道路・全算定位置で計画 ≧ 適合）` : `斜線を最大 ${mm(roadOver)}mm 超え、天空率でも不適合` });
    } else if (r.skyEnabled && skyErr) {
      rows.push({ item: "道路斜線", status: "ng", detail: `斜線を最大 ${mm(roadOver)}mm 超え。天空率は計算できず: ${(skyErr.result as { error: string }).error}` });
    } else {
      rows.push({ item: "道路斜線", status: "ng", detail: `最大 ${mm(roadOver)}mm 超え（天空率は未計算）` });
    }
  } else {
    rows.push({ item: "道路斜線", status: "ok", detail: `屋根面・軒先の全点が斜線の内側${roads.length > 1 ? `（${roads.length} 方向道路、令132条で幅員をみなし）` : ""}${roadLevelOffset(project) !== 0 ? `、高低差 ${project.site.roadLevelDiff}m を考慮` : ""}` });
  }
  if (!r.skyEnabled) rows.push({ item: "天空率（道路）", status: "na", detail: "未使用" });
  else if (!skyAll) rows.push({ item: "天空率（道路）", status: "unknown", detail: "未計算" });
  else for (const x of skyAll) {
    const res = x.result;
    rows.push({ item: `天空率（${x.road}）`, status: "error" in res ? "unknown" : res.ok ? "ok" : "ng", detail: "error" in res ? res.error : `算定位置 ${res.points.length} 点（間隔 ${round(res.info.pitch, 2)}m）、最小余裕 ${round(res.worst * 100, 2)} ポイント。${res.info.note.join("。")}` });
  }

  const nb = lims.find((l) => l.key === "neighbor");
  if (!r.neighborEnabled) rows.push({ item: "隣地斜線", status: "na", detail: "対象外（低層住専）または未使用" });
  else rows.push({ item: "隣地斜線", status: nb && nb.over > 0 ? "ng" : "ok", detail: nb && nb.over > 0 ? `最大 ${mm(nb.over)}mm 超え${wp(nb)}` : `${r.neighborBase}m＋${r.neighborSlope}×距離 の内側` });

  const north = lims.find((l) => l.key === "north");
  if (!r.northEnabled) rows.push({ item: "北側斜線", status: "na", detail: "対象外（低層・中高層住専以外）" });
  else rows.push({ item: "北側斜線", status: north && north.over > 0 ? "ng" : "ok", detail: north && north.over > 0 ? `最大 ${mm(north.over)}mm 超え${wp(north)}` : `${r.northBase}m＋${r.northSlope}×真北距離 の内側${north?.worst ? `（余裕 最小 ${mm(north.worst.limit - north.worst.z)}mm）` : ""}` });

  const kodo = lims.find((l) => l.key === "kodo");
  const kp = KODO_PRESETS.find((k) => k.id === r.kodoPresetId);
  if (!r.kodoEnabled) rows.push({ item: "高度地区", status: "unknown", detail: "未設定。指定の有無を都市計画図で確認してください" });
  else if (!r.kodoSegs.length && !r.kodoAbsolute) rows.push({ item: "高度地区", status: "unknown", detail: `${kp?.name ?? "手入力"}: 数値が入っていません` });
  else rows.push({ item: "高度地区", status: (kodo && kodo.over > 0) || (r.kodoAbsolute > 0 && lv.max > r.kodoAbsolute) ? "ng" : kp && !kp.verified ? "unknown" : "ok", detail: `${kp?.name ?? "手入力"}${kp && !kp.verified ? "【要確認: 数値は検索要約からの転記】" : ""}${kodo && kodo.over > 0 ? ` 斜線を最大 ${mm(kodo.over)}mm 超え${wp(kodo)}` : kodo?.worst ? ` 斜線の余裕 最小 ${mm(kodo.worst.limit - kodo.worst.z)}mm（軒先・屋根面の全点で判定）` : ""}${r.kodoAbsolute > 0 && lv.max > r.kodoAbsolute ? ` 絶対高さ ${r.kodoAbsolute}m を超え` : ""}` });

  const abs = lims.find((l) => l.key === "abs");
  if (r.absoluteMax > 0) rows.push({ item: "絶対高さ（法55条）", status: abs && abs.over > 0 ? "ng" : "ok", detail: `${r.absoluteMax}m（最高高さ ${mm(lv.max)}mm）` });
  rows.push({ item: "日影規制", status: "unknown", detail: "未対応。対象区域・測定面・時間は役所で確認" });
  rows.push({ item: "防火・準防火", status: "unknown", detail: "未対応（外壁・開口部の仕様に影響）" });
  return rows;
}

export function useSky(project: Project): SkyAll | null {
  return useMemo(() => {
    const r = rulesOf(project);
    if (!r.skyEnabled) return null;
    const lv = levels(project.building);
    const zOff = roadLevelOffset(project);
    const roads = roadInfos(project);
    if (!roads.length) return [{ road: "道路", result: { error: "道路の辺が設定されていません" } }];
    return roads.map((rd) => ({
      road: roads.length > 1 ? `${rd.label} ${rd.width}m` : "道路",
      result: checkSkyFactor({ site: project.site, grid: project.grid, building: project.building, slope: r.roadSlope, applyDist: r.roadApplyDist, eave: lv.eave, maxHeight: lv.max, roadEdgeIndex: rd.edgeIndex, effWidth: rd.effWidth, zOff }),
    }));
  }, [project]);
}

export default function HeightCheck({ project, setProject }: Props) {
  const r = rulesOf(project);
  const { site, building: b } = project;
  const setR = (next: HeightRules) => setProject((p) => ({ ...p, site: { ...p.site, heightRules: next } }));
  const patch = (x: Partial<HeightRules>) => setR({ ...r, ...x });
  const sky = useSky(project);
  const rows = verdictRows(project, sky);
  const prefs = ["東京都", "神奈川県"] as const;
  const kp = KODO_PRESETS.find((k) => k.id === r.kodoPresetId);
  const lv = levels(b);

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold">法規チェック（参考）</h3>

      {/* 判定表 */}
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.item} className="border-b border-dashed border-slate-200 align-top">
              <td className="py-1 pr-1 whitespace-nowrap font-medium">{row.item}</td>
              <td className="py-1 pr-1 whitespace-nowrap">
                <span className={`rounded px-1.5 py-0.5 ${row.status === "ok" ? "bg-emerald-100 text-emerald-800" : row.status === "ng" ? "bg-red-100 text-red-700" : row.status === "na" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-800"}`}>
                  {row.status === "ok" ? "確認済み" : row.status === "ng" ? "超過" : row.status === "na" ? "対象外" : "未確認"}
                </span>
              </td>
              <td className="py-1 text-slate-600">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 用途地域 */}
      <div className="space-y-1 text-xs">
        <span className="label">用途地域（都市計画図で確認して選ぶ）</span>
        <select className="field" value={r.zoneId} onChange={(e) => setR(rulesFromZone(e.target.value, site.farRatio, r))}>
          <option value="">— 選択 —</option>
          {ZONE_PRESETS.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col"><span className="text-[9px] text-slate-400">道路斜線 勾配</span><input type="number" step="0.05" className="field px-1 py-0.5" value={r.roadSlope} onChange={(e) => patch({ roadSlope: Number(e.target.value) })} /></label>
          <label className="flex flex-col"><span className="text-[9px] text-slate-400">適用距離 m（容積率{site.farRatio}%）</span><input type="number" step="5" className="field px-1 py-0.5" value={r.roadApplyDist} onChange={(e) => patch({ roadApplyDist: Number(e.target.value) })} /></label>
          <label className="col-span-2 flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={r.northEnabled} onChange={(e) => patch({ northEnabled: e.target.checked })} />北側斜線 <input type="number" step="1" className="field w-14 px-1 py-0.5" value={r.northBase} onChange={(e) => patch({ northBase: Number(e.target.value) })} />m ＋ <input type="number" step="0.05" className="field w-16 px-1 py-0.5" value={r.northSlope} onChange={(e) => patch({ northSlope: Number(e.target.value) })} />×L</label>
          <label className="col-span-2 flex items-center gap-1 whitespace-nowrap"><input type="checkbox" checked={r.neighborEnabled} onChange={(e) => patch({ neighborEnabled: e.target.checked })} />隣地斜線 <input type="number" step="1" className="field w-14 px-1 py-0.5" value={r.neighborBase} onChange={(e) => patch({ neighborBase: Number(e.target.value) })} />m ＋ <input type="number" step="0.05" className="field w-16 px-1 py-0.5" value={r.neighborSlope} onChange={(e) => patch({ neighborSlope: Number(e.target.value) })} />×L</label>
          <label className="flex flex-col"><span className="text-[9px] text-slate-400">絶対高さ m（0=無し）</span><input type="number" step="1" className="field px-1 py-0.5" value={r.absoluteMax} onChange={(e) => patch({ absoluteMax: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2 self-end"><input type="checkbox" checked={r.skyEnabled} onChange={(e) => patch({ skyEnabled: e.target.checked })} />天空率で検討</label>
        </div>
        <p className="text-[10px] text-slate-400">勾配・適用距離は別表第3の転記（出典: <a className="underline" href={ZONE_SOURCE} target="_blank" rel="noreferrer">解説記事</a>）。原文は e-Gov の建築基準法 別表第3 で確認してください。</p>
      </div>

      {/* 高度地区 */}
      <div className="space-y-1 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={r.kodoEnabled} onChange={(e) => patch({ kodoEnabled: e.target.checked })} /><span className="font-medium">高度地区</span></label>
        {r.kodoEnabled && (
          <>
            <select className="field" value={r.kodoPresetId} onChange={(e) => setR(rulesFromKodo(e.target.value, r))}>
              <option value="">— プリセットから選ぶ（東京都・神奈川県）／手入力 —</option>
              {prefs.map((pref) => (
                <optgroup key={pref} label={pref}>
                  {KODO_PRESETS.filter((k) => k.pref === pref).map((k) => <option key={k.id} value={k.id}>{k.city}　{k.name}</option>)}
                </optgroup>
              ))}
            </select>
            {kp && (
              <div className="rounded bg-amber-50 p-1.5 text-[10px] leading-relaxed text-amber-900">
                【要確認】この数値は検索結果の要約からの転記で、原文は未確認です。{kp.note ? kp.note + "。" : ""}
                出典: <a className="underline" href={kp.source} target="_blank" rel="noreferrer">{kp.source.replace(/^https?:\/\//, "").slice(0, 40)}…</a>
              </div>
            )}
            <div className="space-y-1">
              {r.kodoSegs.map((s, i) => (
                <div key={i} className="flex items-center gap-1 whitespace-nowrap text-[10px]">
                  <span className="text-slate-500">L</span>
                  <input type="number" step="1" className="field w-11 px-1 py-0.5" value={s.from} onChange={(e) => { const segs = r.kodoSegs.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)); patch({ kodoSegs: segs }); }} />
                  <span>〜</span>
                  <input type="number" step="1" className="field w-11 px-1 py-0.5" value={s.upTo ?? ""} placeholder="∞" onChange={(e) => { const segs = r.kodoSegs.map((x, j) => (j === i ? { ...x, upTo: e.target.value === "" ? null : Number(e.target.value) } : x)); patch({ kodoSegs: segs }); }} />
                  <span>m: ≤</span>
                  <input type="number" step="0.1" className="field w-12 px-1 py-0.5" value={s.base} onChange={(e) => { const segs = r.kodoSegs.map((x, j) => (j === i ? { ...x, base: Number(e.target.value) } : x)); patch({ kodoSegs: segs }); }} />
                  <span>＋</span>
                  <input type="number" step="0.05" className="field w-12 px-1 py-0.5" value={s.slope} onChange={(e) => { const segs = r.kodoSegs.map((x, j) => (j === i ? { ...x, slope: Number(e.target.value) } : x)); patch({ kodoSegs: segs }); }} />
                  <span>×(L−{s.from})</span>
                  <button className="text-red-500" onClick={() => patch({ kodoSegs: r.kodoSegs.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <button className="btn-ghost px-2 py-0.5" onClick={() => { const last = r.kodoSegs[r.kodoSegs.length - 1]; patch({ kodoSegs: [...r.kodoSegs, { from: last?.upTo ?? 0, upTo: null, base: last ? last.base + last.slope * ((last.upTo ?? 0) - last.from) : 5, slope: 1.25 }] }); }}>＋区間</button>
                <label className="flex items-center gap-1"><span className="text-slate-500">絶対高さ</span><input type="number" step="1" className="field w-14 px-1 py-0.5" value={r.kodoAbsolute} onChange={(e) => patch({ kodoAbsolute: Number(e.target.value) })} />m</label>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 天空率 */}
      {r.skyEnabled && sky && sky.map(({ road, result: skyR }) => (
        <div key={road} className="space-y-1 text-xs">
          <div className="font-medium">天空率（{road}・令135条の6〜9 参考計算）</div>
          {"error" in skyR ? (
            <div className="text-red-600">{skyR.error}</div>
          ) : (() => { const sky = skyR; return (
            <>
              <div className="text-[10px] text-slate-500">道路幅 {sky.info.roadW}m、後退 {Math.round(sky.info.back * 1000)}mm、勾配 {sky.info.slope}、適用距離 {sky.info.applyDist}m。算定位置は道路の反対側の境界線（後退分だけ外側）上、間隔 {round(sky.info.pitch, 2)}m。</div>
              <table className="w-full text-[11px]">
                <thead><tr className="text-slate-500"><th className="text-left">位置</th><th className="text-right">適合建築物</th><th className="text-right">計画建築物</th><th className="text-right">判定</th></tr></thead>
                <tbody>
                  {sky.points.map((p) => (
                    <tr key={p.index} className="border-b border-dashed border-slate-200">
                      <td>P{p.index}（{round(p.u, 2)}m）</td>
                      <td className="text-right tabular-nums">{(p.conform * 100).toFixed(1)}%</td>
                      <td className="text-right tabular-nums">{(p.plan * 100).toFixed(1)}%</td>
                      <td className={`text-right font-medium ${p.ok ? "text-emerald-700" : "text-red-600"}`}>{p.ok ? "○" : "×"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SkyDiagram sky={sky} />
              <div className="text-[10px] leading-relaxed text-slate-500">
                適合は小数第3位で切り上げ、計画は切り捨てで比較（審査実務の安全側）。入隅・凹形敷地の厳密扱い・北側／隣地の天空率は未対応。確認申請には確認申請ソフトの天空率図との照合が必要です。
              </div>
            </>
          ); })()}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col"><span className="text-[9px] text-slate-400">敷地が道路より高い量 m（令135条の2）</span><input type="number" step="0.1" className="field px-1 py-0.5" value={site.roadLevelDiff ?? 0} onChange={(e) => setProject((p) => ({ ...p, site: { ...p.site, roadLevelDiff: Number(e.target.value) } }))} /></label>
        <label className="flex items-center gap-2 self-end"><input type="checkbox" checked={!!site.cornerLot} onChange={(e) => setProject((p) => ({ ...p, site: { ...p.site, cornerLot: e.target.checked } }))} />角地の建ぺい率緩和（＋10%）</label>
      </div>
      <p className="text-[10px] text-slate-400">最高高さ {Math.round(lv.max * 1000).toLocaleString()}mm。図の破線は各面の外から見た制限ライン。</p>
    </div>
  );
}

/** 最悪の算定位置の天空図（正射影）。外周が地平、中心が天頂 */
function SkyDiagram({ sky }: { sky: SkyResult }) {
  const R = 60;
  const poly = (prof: number[]) => {
    const n = prof.length;
    return prof.map((alt, i) => {
      const phi = ((i + 0.5) / n) * 2 * Math.PI;
      const rr = R * Math.cos(alt);
      // 方位角: 道路座標の u 軸を右、v（敷地の内側）を上に
      return `${R + rr * Math.cos(phi)},${R - rr * Math.sin(phi)}`;
    }).join(" ");
  };
  const worst = sky.points.reduce((a, p) => (p.plan - p.conform < a.plan - a.conform ? p : a), sky.points[0]);
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${R * 2} ${R * 2}`} className="h-32 w-32 shrink-0">
        <circle cx={R} cy={R} r={R} fill="#eaf2fb" stroke="#333" strokeWidth={0.8} />
        <polygon points={`${poly(sky.diagram.conform)}`} fill="rgba(192,57,43,0.25)" stroke="#c0392b" strokeWidth={0.8} />
        <polygon points={`${poly(sky.diagram.plan)}`} fill="rgba(47,111,237,0.35)" stroke="#2f6fed" strokeWidth={0.8} />
        <line x1={R} y1={0} x2={R} y2={R * 2} stroke="#999" strokeWidth={0.3} />
        <line x1={0} y1={R} x2={R * 2} y2={R} stroke="#999" strokeWidth={0.3} />
        <text x={R} y={8} textAnchor="middle" fontSize={6} fill="#555">敷地側</text>
      </svg>
      <div className="text-[10px] leading-relaxed text-slate-600">
        最も厳しい位置 P{worst.index} の天空図。<span className="text-red-700">赤＝適合建築物</span>、<span className="text-blue-700">青＝計画建築物</span>。青の面積が赤以下なら適合（空が広い）。
      </div>
    </div>
  );
}
