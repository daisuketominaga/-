"use client";

import { useState } from "react";
import type { SlopeSeg } from "@/lib/heightPresets";
import { fileToDataUrl, pdfToDataUrl, shrink } from "@/lib/imageInput";

type Props = { defaultKind: string; city?: string; onResult: (r: { segs: SlopeSeg[]; absoluteMax: number; label: string }) => void };

/** 高度地区の資料（取扱基準のPDF・都市計画図の凡例のスクリーンショット等）から制限の式を読み取る */
export default function KodoImport({ defaultKind, city, onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [msg, setMsg] = useState<string | null>(null);
  const [res, setRes] = useState<{ segs: SlopeSeg[]; absoluteMax: number; confidence: string; quote: string; notes: string; kind: string; city: string } | null>(null);

  const handle = async (file: File) => {
    setBusy(true); setMsg(null); setRes(null);
    try {
      let dataUrl = file.type === "application/pdf" ? await pdfToDataUrl(file) : await fileToDataUrl(file);
      dataUrl = await shrink(dataUrl, 2000);
      const r = await fetch("/api/kodo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl, kind, city }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "読み取りに失敗しました");
      setRes(json);
      if (!json.segs.length && !json.absoluteMax) setMsg("この画像から数値は読み取れませんでした（該当種別の記載が無いか、不鮮明）。");
    } catch (e) {
      setMsg("エラー: " + (e as Error).message);
    } finally { setBusy(false); }
  };
  const fmt = (s: SlopeSeg) => `L${s.upTo === null ? `≧${s.from}` : `${s.from}〜${s.upTo}`}m: ${s.base}m＋${s.slope}×(L−${s.from})`;

  return (
    <div className="space-y-1 rounded border border-dashed border-slate-300 p-2 text-[11px]">
      <div className="font-medium text-slate-700">資料から式を読み取る（取扱基準のPDF・都市計画図の凡例など）</div>
      <div className="flex items-center gap-1">
        <input className="field px-1 py-0.5" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="第4種高度地区" />
        <label className={`btn-ghost cursor-pointer whitespace-nowrap px-2 py-0.5 ${busy ? "opacity-50" : ""}`}>
          {busy ? "読み取り中…" : "画像/PDFを選ぶ"}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
        </label>
      </div>
      {msg && <div className={msg.startsWith("エラー") ? "text-red-600" : "text-amber-700"}>{msg}</div>}
      {res && (res.segs.length > 0 || res.absoluteMax > 0) && (
        <div className="space-y-1 rounded bg-emerald-50 p-1.5 text-emerald-900">
          <div><b>{res.city} {res.kind}</b>（確度: {res.confidence}）</div>
          {res.segs.map((s, i) => <div key={i}>北側: {fmt(s)}</div>)}
          {res.absoluteMax > 0 && <div>絶対高さ: {res.absoluteMax}m</div>}
          {res.quote && <div className="text-slate-600">原文: 「{res.quote}」</div>}
          {res.notes && <div className="text-slate-600">{res.notes}</div>}
          <button className="btn-primary px-2 py-0.5" onClick={() => onResult({ segs: res.segs, absoluteMax: res.absoluteMax, label: `${res.city} ${res.kind}（資料から読み取り・${res.confidence}）` })}>この値を使う</button>
          <div className="text-[10px] text-slate-500">読み取り結果は原文と見比べてください。「確認済み」にするには役所・確認検査機関での確認が必要です。</div>
        </div>
      )}
    </div>
  );
}
