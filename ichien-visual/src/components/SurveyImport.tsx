"use client";

import { useState } from "react";
import type { Site } from "@/lib/types";
import { fileToDataUrl, pdfToDataUrl, shrink } from "@/lib/imageInput";

type Props = { onResult: (s: Partial<Site>) => void };

export default function SurveyImport({ onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [coords, setCoords] = useState<{ label: string; X: number; Y: number }[] | null>(null);

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
      let json: { site?: Partial<Site>; coords?: unknown; notes?: string; error?: string };
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(res.status === 504 || /timed out|Timeout/i.test(raw) ? "サーバーの制限時間内に読み取りが終わりませんでした。もう一度試すか、画像を1枚ずつ（先に測量図、次に販売図面）読み込ませてください。" : `サーバーがエラーを返しました（${res.status}）: ${raw.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(json.error || "読み取りに失敗しました");
      if (!json.site?.points) throw new Error("読み取り結果に境界点がありません");
      onResult(json.site);
      setCoords(Array.isArray(json.coords) && json.coords.length ? (json.coords as { label: string; X: number; Y: number }[]) : null);
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
      {coords && (
        <details className="text-xs" open>
          <summary className="cursor-pointer text-slate-600">求積表の座標と、そこから計算した辺の長さ</summary>
          <table className="mt-1 w-full text-[11px]">
            <thead><tr className="text-slate-500"><th className="text-left">点</th><th className="text-right">X(南北)</th><th className="text-right">Y(東西)</th><th className="text-right">次の点まで</th></tr></thead>
            <tbody>
              {coords.map((c, i) => {
                const n = coords[(i + 1) % coords.length];
                const len = Math.hypot(n.X - c.X, n.Y - c.Y);
                return (
                  <tr key={c.label + i} className="border-t border-slate-100">
                    <td>{c.label}</td><td className="text-right">{c.X.toFixed(3)}</td><td className="text-right">{c.Y.toFixed(3)}</td><td className="text-right font-medium">{len.toFixed(3)} m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
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
