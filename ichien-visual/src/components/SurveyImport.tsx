"use client";

import { useState } from "react";
import type { Site, SurveyCoord, RoadEvidence } from "@/lib/types";
import { polygonArea, dist } from "@/lib/geometry";
import { fileToDataUrl, pdfToDataUrl, shrink } from "@/lib/imageInput";

type RoadEv = RoadEvidence;
/** site を渡すと、前回の読み取りで保存した求積表の座標・道路の根拠を表示し、辺長・面積の検算も出す */
type Props = { onResult: (s: Partial<Site>) => void; onUnroad?: (index: number) => void; pointCount?: number; site?: Site };

export default function SurveyImport({ onResult, onUnroad, pointCount, site }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [coordsLocal, setCoords] = useState<SurveyCoord[] | null>(null);
  const [roadEvLocal, setRoadEv] = useState<RoadEv[] | null>(null);
  // 読み取り直後はその結果、画面を開き直したときは物件に保存した値を見せる
  const coords = coordsLocal ?? site?.surveyCoords ?? null;
  const roadEv = roadEvLocal ?? site?.roadEvidence ?? [];

  const handle = async (files: File[]) => {
    setBusy(true);
    setMsg(null);
    try {
      // 1枚目が測量図、2枚目以降は販売図面・区画図（道路・後退・面積の補足）。ファイル名に「販売」「図面」「区画」があれば後ろへ回す
      const score = (f: File) => (/販売|区画|チラシ|マイソク|図面/.test(f.name) ? 1 : 0);
      const ordered = [...files].sort((a, b) => score(a) - score(b)).slice(0, 4);
      const urls: string[] = [];
      for (const f of ordered) {
        let dataUrl = f.type === "application/pdf" ? await pdfToDataUrl(f) : await fileToDataUrl(f);
        dataUrl = await shrink(dataUrl);
        urls.push(dataUrl);
      }
      setPreview(urls);
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: urls, hint }),
      });
      const raw = await res.text();
      let json: { site?: Partial<Site>; coords?: unknown; coordSystem?: string | null; notes?: string; error?: string; roadEvidence?: RoadEv[] };
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(res.status === 504 || /timed out|Timeout/i.test(raw) ? "サーバーの制限時間内に読み取りが終わりませんでした。もう一度試すか、画像を1枚ずつ（先に測量図、次に販売図面）読み込ませてください。" : `サーバーがエラーを返しました（${res.status}）: ${raw.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(json.error || "読み取りに失敗しました");
      if (!json.site?.points) throw new Error("読み取り結果に境界点がありません");
      const coordsRead = Array.isArray(json.coords) && json.coords.length ? (json.coords as SurveyCoord[]).filter((c) => c && typeof c.X === "number" && typeof c.Y === "number") : [];
      const evRead = Array.isArray(json.roadEvidence) ? json.roadEvidence : [];
      // 求積表の元座標・座標系・道路の根拠も物件に保存する（辺長・面積の検算と、後で見返すため）
      onResult({ ...json.site, surveyCoords: coordsRead.length ? coordsRead : undefined, coordSystem: typeof json.coordSystem === "string" ? json.coordSystem : undefined, roadEvidence: evRead.length ? evRead : undefined });
      setCoords(coordsRead.length ? coordsRead : null);
      setRoadEv(evRead);
      setMsg(`読み取りました：境界点 ${json.site.points.length} 点。${json.notes ?? ""} 数字は必ず測量図と見比べて、違う所は左の表で直してください。`);
    } catch (e) {
      setMsg("エラー: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="card space-y-2">
      <h3 className="text-sm font-semibold">測量図から読み取る</h3>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 hover:border-brand-500 hover:bg-brand-50">
        <span className="text-xl">📐</span>
        <span className="mt-1 font-medium text-slate-700">測量図・地積測量図・公図（画像 / PDF）</span>
        <span>AIが境界点・辺長・道路・方位を読み取ります</span>
        <span className="mt-1 text-[11px] text-brand-700">販売図面（区画図）も一緒に選ぶと、両面道路・幅員・道路後退・有効面積を補って読みます（複数選択OK）</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          multiple
          disabled={busy}
          onChange={(e) => e.target.files?.length && handle(Array.from(e.target.files))}
        />
      </label>
      <input className="field" placeholder="補足（例: 西側が4m公道、面積79.43㎡）" value={hint} onChange={(e) => setHint(e.target.value)} />
      {busy && <div className="text-xs text-brand-700">読み取り中… 1枚で20〜40秒、2枚だと1〜2分かかります</div>}
      {msg && <div className={`text-xs ${msg.startsWith("エラー") ? "text-red-600" : "text-emerald-700"}`}>{msg}</div>}
      {roadEv.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
          <div className="font-semibold">道路と判断した辺（根拠を確認してください）</div>
          <ul className="mt-1 space-y-1">
            {roadEv.map((r) => {
              const n = pointCount ?? 0;
              const to = n ? ((r.index + 1) % n) + 1 : r.index + 2;
              return (
                <li key={r.index} className="flex items-start gap-2">
                  <div className="flex-1">
                    <div>
                      <b>P{r.index + 1}→P{to}</b>　{r.label}　幅員 {r.width ?? "?"}m{r.setback ? `・後退 ${r.setback}m` : ""}　{r.confidence === "low" ? <span className="text-red-700">（推測・要確認）</span> : ""}
                    </div>
                    <div className="text-amber-800">外側: {r.neighbor || "不明"}{r.evidence ? `／根拠: ${r.evidence}` : ""}</div>
                  </div>
                  {onUnroad && (
                    <button className="btn-ghost shrink-0 px-2 py-0.5 text-[11px]" onClick={() => { onUnroad(r.index); setRoadEv(roadEv.filter((x) => x.index !== r.index)); }}>道路ではない</button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-1 text-amber-800">道路でない辺があれば「道路ではない」を押してください。道路がまだ足りなければ、下の「辺ごとの道路・後退」でチェックできます。</div>
        </div>
      )}
      {coords && coords.length > 0 && (() => {
        // 検算: 求積表の座標から辺長（隣の点まで）と面積（座標法）を出し、保存している辺長・地積と比べる
        const n = coords.length;
        const edgeLens = coords.map((c, i) => { const q = coords[(i + 1) % n]; return Math.hypot(q.X - c.X, q.Y - c.Y); });
        const areaCoords = polygonArea(coords.map((c) => ({ x: c.Y, y: c.X })));
        const samePoints = !!site && site.points.length === n;
        const savedLen = (i: number) => (samePoints && site ? site.edges.find((e) => e.index === i)?.length ?? dist(site.points[i], site.points[(i + 1) % n]) : undefined);
        const areaSaved = site?.areaOverride;
        const bad = (a: number, b: number | undefined, tol: number) => b !== undefined && Math.abs(a - b) > tol;
        return (
          <details className="text-xs" open>
            <summary className="cursor-pointer text-slate-600">求積表の座標と検算（辺長・面積）{site?.coordSystem ? `　座標系: ${site.coordSystem}` : ""}</summary>
            <table className="mt-1 w-full text-[11px]">
              <thead><tr className="text-slate-500"><th className="text-left">点</th><th className="text-right">X(南北)</th><th className="text-right">Y(東西)</th><th className="text-right">次の点まで</th><th className="text-right">図の辺長</th></tr></thead>
              <tbody>
                {coords.map((c, i) => {
                  const sv = savedLen(i);
                  const ng = bad(edgeLens[i], sv, 0.02);
                  return (
                    <tr key={c.label + i} className={`border-t border-slate-100 ${ng ? "text-red-700" : ""}`}>
                      <td>{c.label}</td><td className="text-right">{c.X.toFixed(3)}</td><td className="text-right">{c.Y.toFixed(3)}</td><td className="text-right font-medium">{edgeLens[i].toFixed(3)} m</td><td className="text-right">{sv !== undefined ? `${sv.toFixed(2)} m${ng ? " ≠" : ""}` : samePoints ? "－" : "点数が違う"}</td>
                    </tr>
                  );
                })}
                <tr className={`border-t border-slate-300 font-medium ${bad(areaCoords, areaSaved, 0.05) ? "text-red-700" : ""}`}>
                  <td colSpan={3}>座標法の面積</td><td className="text-right">{areaCoords.toFixed(2)} ㎡</td><td className="text-right">{areaSaved !== undefined ? `地積 ${areaSaved.toFixed(2)} ㎡${bad(areaCoords, areaSaved, 0.05) ? " ≠" : ""}` : "地積 未入力"}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-slate-500">赤は、座標からの計算と図に書かれた値が 2cm（面積は 0.05㎡）以上ずれている箇所です。読み取りミスか図面の表記ゆれかを測量図で確認してください。座標・根拠は物件に保存されます。</p>
          </details>
        );
      })()}
      {preview.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500">送った画像を見る（{preview.length}枚）</summary>
          {preview.map((u, i) => <img key={i} src={u} alt={i === 0 ? "測量図" : "販売図面"} className="mt-1 w-full rounded border" />)}
        </details>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">
        読み取りはClaude APIを使います（使った時だけ課金）。図面の質で精度が変わるので、結果は必ず人が確認する前提です。
      </p>
    </div>
  );
}
