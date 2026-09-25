"use client";

import { useState } from "react";
import type { Site } from "@/lib/types";

type Props = { onResult: (s: Partial<Site>) => void };

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("読み込み失敗"));
    r.readAsDataURL(file);
  });
}

/** PDFの1ページ目を画像にする（ブラウザ内） */
async function pdfToDataUrl(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

/** 長辺を最大 1800px に縮小してからAPIへ送る */
async function shrink(dataUrl: string, max = 1800): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("画像を開けません"));
    img.src = dataUrl;
  });
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

export default function SurveyImport({ onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [coords, setCoords] = useState<{ label: string; X: number; Y: number }[] | null>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      let dataUrl = file.type === "application/pdf" ? await pdfToDataUrl(file) : await fileToDataUrl(file);
      dataUrl = await shrink(dataUrl);
      setPreview(dataUrl);
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, hint }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "読み取りに失敗しました");
      onResult(json.site);
      setCoords(Array.isArray(json.coords) && json.coords.length ? json.coords : null);
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
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
      </label>
      <input className="field" placeholder="補足（例: 西側が4m公道、面積79.43㎡）" value={hint} onChange={(e) => setHint(e.target.value)} />
      {busy && <div className="text-xs text-brand-700">読み取り中… 20〜40秒かかります</div>}
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
      {preview && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500">送った画像を見る</summary>
          <img src={preview} alt="測量図" className="mt-1 w-full rounded border" />
        </details>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">
        読み取りはClaude APIを使います（使った時だけ課金）。図面の質で精度が変わるので、結果は必ず人が確認する前提です。
      </p>
    </div>
  );
}
