"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

type Preset = "bright" | "natural" | "warm" | "cool";

const PRESETS: Record<Preset, { label: string; desc: string; targetL: number; contrast: number; sat: number; temp: number; gamma: number }> = {
  bright: { label: "明るい", desc: "SUUMO向け。白っぽく明るく、影を持ち上げる", targetL: 0.62, contrast: 1.06, sat: 1.08, temp: 0.0, gamma: 0.85 },
  natural: { label: "自然", desc: "見たままに近い。明るさだけ揃える", targetL: 0.55, contrast: 1.0, sat: 1.0, temp: 0.0, gamma: 1.0 },
  warm: { label: "暖かい", desc: "夕方の室内向け。少し黄みを足す", targetL: 0.58, contrast: 1.04, sat: 1.1, temp: 0.08, gamma: 0.9 },
  cool: { label: "すっきり", desc: "外観向け。青みを足してくっきり", targetL: 0.58, contrast: 1.1, sat: 1.05, temp: -0.06, gamma: 0.92 },
};

type Item = {
  id: string;
  file: File;
  name: string;
  originalUrl: string;
  outUrl?: string;
  outBlob?: Blob;
  width: number;
  height: number;
  meanL: number;
  /** 個別の微調整（プリセットに加算） */
  exposure: number;
};

type Settings = {
  preset: Preset;
  exposure: number; // -1..1
  contrast: number; // 0.8..1.3
  saturation: number; // 0.5..1.5
  temperature: number; // -0.2..0.2
  autoWhiteBalance: boolean;
  maxSize: number;
  quality: number;
};

const DEFAULT: Settings = {
  preset: "bright",
  exposure: 0,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  autoWhiteBalance: true,
  maxSize: 2000,
  quality: 0.9,
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を読み込めません: " + file.name));
    img.src = url;
  });
}

/** 平均輝度（0..1）を粗く計算 */
function measure(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  const s = 64;
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, s, s);
  const d = ctx.getImageData(0, 0, s, s).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  }
  return sum / (d.length / 4);
}

/**
 * 1枚を補正する。処理の流れ:
 * 1) 目標の明るさに合わせて露出を自動で合わせる（全枚統一の肝）
 * 2) ガンマで暗部を持ち上げる
 * 3) グレーワールド法で色かぶりを軽く補正
 * 4) コントラスト・彩度・色温度
 */
function processImage(img: HTMLImageElement, meanL: number, s: Settings, extraExposure: number, maxSize: number): HTMLCanvasElement {
  const p = PRESETS[s.preset];
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  // 1) 露出: 目標輝度に向けて、まず控えめにゲイン（白飛びを防ぐ）
  const target = Math.min(0.9, Math.max(0.2, p.targetL));
  let gain = target / Math.max(0.05, meanL);
  gain = Math.max(0.7, Math.min(1.5, gain));
  gain *= Math.pow(2, s.exposure + extraExposure);
  // 2) 残りはガンマで中間調を持ち上げ/下げして、平均輝度が目標に届くようにする
  const meanAfterGain = Math.min(0.98, Math.max(0.02, meanL * gain));
  const gammaAuto = Math.max(0.4, Math.min(1.6, Math.log(target) / Math.log(meanAfterGain)));

  // 3) グレーワールド: RGB平均が等しくなるよう係数を出す
  let rs = 0, gs = 0, bs = 0;
  const step = 16;
  let cnt = 0;
  for (let i = 0; i < d.length; i += 4 * step) {
    rs += d[i];
    gs += d[i + 1];
    bs += d[i + 2];
    cnt++;
  }
  const avg = (rs + gs + bs) / (3 * cnt) || 1;
  let wr = 1, wg = 1, wb = 1;
  if (s.autoWhiteBalance && cnt) {
    // 補正は半分だけ効かせる（やりすぎると不自然になる）
    wr = 1 + (avg / (rs / cnt) - 1) * 0.5;
    wg = 1 + (avg / (gs / cnt) - 1) * 0.5;
    wb = 1 + (avg / (bs / cnt) - 1) * 0.5;
  }
  const temp = s.temperature + p.temp;
  const tr = 1 + temp * 0.6;
  const tb = 1 - temp * 0.6;
  const contrast = s.contrast * p.contrast;
  const sat = s.saturation * p.sat;
  const gamma = gammaAuto * p.gamma;

  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = v / 255;
    x = x * gain;
    x = Math.pow(Math.min(1, x), gamma);
    x = (x - 0.5) * contrast + 0.5;
    lut[v] = Math.max(0, Math.min(255, Math.round(x * 255)));
  }

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * wr * tr;
    let g = d[i + 1] * wg;
    let b = d[i + 2] * wb * tb;
    r = lut[Math.max(0, Math.min(255, Math.round(r)))];
    g = lut[Math.max(0, Math.min(255, Math.round(g)))];
    b = lut[Math.max(0, Math.min(255, Math.round(b)))];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l + (r - l) * sat;
    g = l + (g - l) * sat;
    b = l + (b - l) * sat;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

function canvasToBlob(c: HTMLCanvasElement, q: number) {
  return new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/jpeg", q));
}

export default function PhotoBatch() {
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const timer = useRef<number | null>(null);

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const next: Item[] = [];
    for (const f of arr) {
      try {
        const img = await loadImage(f);
        const id = Math.random().toString(36).slice(2);
        imgCache.current.set(id, img);
        next.push({
          id,
          file: f,
          name: f.name,
          originalUrl: img.src,
          width: img.width,
          height: img.height,
          meanL: measure(img),
          exposure: 0,
        });
      } catch (e) {
        console.warn(e);
      }
    }
    setItems((prev) => [...prev, ...next]);
  };

  const run = useCallback(async () => {
    if (items.length === 0) return;
    setBusy(true);
    setProgress(0);
    const out: Item[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const img = imgCache.current.get(it.id);
      if (!img) continue;
      // プレビューは軽く（長辺1000）、書き出し時に本番サイズで再処理する
      const c = processImage(img, it.meanL, settings, it.exposure, 1000);
      const blob = await canvasToBlob(c, 0.85);
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      out.push({ ...it, outUrl: URL.createObjectURL(blob) });
      setProgress(Math.round(((i + 1) / items.length) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }
    setItems(out);
    setBusy(false);
  }, [items, settings]);

  // 設定が変わったら少し待ってから自動再処理
  useEffect(() => {
    if (items.length === 0) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      run();
    }, 350);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, items.length, items.map((i) => i.exposure).join(",")]);

  const exportZip = async () => {
    setBusy(true);
    const zip = new JSZip();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const img = imgCache.current.get(it.id);
      if (!img) continue;
      const c = processImage(img, it.meanL, settings, it.exposure, settings.maxSize);
      const blob = await canvasToBlob(c, settings.quality);
      const base = it.name.replace(/\.[^.]+$/, "");
      zip.file(`${String(i + 1).padStart(2, "0")}_${base}.jpg`, blob);
      setProgress(Math.round(((i + 1) / items.length) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `補正済み写真_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    setBusy(false);
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    imgCache.current.delete(id);
    if (selected === id) setSelected(null);
  };

  const sel = useMemo(() => items.find((i) => i.id === selected) ?? null, [items, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-3">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 hover:border-brand-500 hover:bg-brand-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <span className="text-2xl">📷</span>
            <span className="mt-1 font-medium text-slate-700">写真をここにドロップ</span>
            <span className="text-xs">またはタップして選択（複数可、20〜30枚OK）</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>
          <p className="text-[11px] leading-relaxed text-slate-500">
            写真はこの端末の中だけで処理します。どこにも送信しません。費用もかかりません。
          </p>
        </div>

        <div className="card space-y-3">
          <div>
            <span className="label">仕上がりの好み</span>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(PRESETS) as Preset[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSettings((s) => ({ ...s, preset: k }))}
                  className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                    settings.preset === k
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-semibold">{PRESETS[k].label}</div>
                  <div className="text-[10px] text-slate-500">{PRESETS[k].desc}</div>
                </button>
              ))}
            </div>
          </div>
          <Slider label="全体の明るさ" value={settings.exposure} min={-1} max={1} step={0.05} onChange={(v) => setSettings((s) => ({ ...s, exposure: v }))} fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(2)} />
          <Slider label="コントラスト" value={settings.contrast} min={0.8} max={1.3} step={0.01} onChange={(v) => setSettings((s) => ({ ...s, contrast: v }))} fmt={(v) => v.toFixed(2)} />
          <Slider label="鮮やかさ" value={settings.saturation} min={0.5} max={1.5} step={0.01} onChange={(v) => setSettings((s) => ({ ...s, saturation: v }))} fmt={(v) => v.toFixed(2)} />
          <Slider label="色味（青←→黄）" value={settings.temperature} min={-0.2} max={0.2} step={0.01} onChange={(v) => setSettings((s) => ({ ...s, temperature: v }))} fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(2)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.autoWhiteBalance} onChange={(e) => setSettings((s) => ({ ...s, autoWhiteBalance: e.target.checked }))} />
            色かぶりを自動で直す
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="label">書き出し長辺(px)</span>
              <select className="field" value={settings.maxSize} onChange={(e) => setSettings((s) => ({ ...s, maxSize: Number(e.target.value) }))}>
                <option value={1200}>1200</option>
                <option value={1600}>1600</option>
                <option value={2000}>2000</option>
                <option value={3000}>3000</option>
                <option value={6000}>元サイズ</option>
              </select>
            </div>
            <div>
              <span className="label">画質</span>
              <select className="field" value={settings.quality} onChange={(e) => setSettings((s) => ({ ...s, quality: Number(e.target.value) }))}>
                <option value={0.8}>標準</option>
                <option value={0.9}>高</option>
                <option value={0.95}>最高</option>
              </select>
            </div>
          </div>
          <button className="btn-primary w-full justify-center" disabled={busy || items.length === 0} onClick={exportZip}>
            {busy ? `処理中… ${progress}%` : `補正済みをまとめて保存（${items.length}枚 ZIP）`}
          </button>
          {items.length > 0 && (
            <button className="btn-ghost w-full justify-center" onClick={() => { setItems([]); imgCache.current.clear(); setSelected(null); }}>
              全部クリア
            </button>
          )}
        </div>
      </aside>

      <section className="space-y-4">
        {items.length === 0 ? (
          <div className="card text-sm text-slate-500">
            <p className="font-medium text-slate-700">使い方</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>現地の写真（外観・室内・周辺）をまとめて入れる</li>
              <li>「明るい」「自然」などの好みを選ぶ。全枚の明るさが自動で揃う</li>
              <li>気になる1枚だけ、クリックして個別に明るさを微調整</li>
              <li>ZIPで保存。ファイル名は番号つきで整理される</li>
            </ol>
          </div>
        ) : (
          <>
            {sel && (
              <div className="card">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{sel.name} <span className="text-xs text-slate-400">{sel.width}×{sel.height}</span></div>
                  <button className="btn-ghost" onClick={() => setSelected(null)}>閉じる</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <figure>
                    <img src={sel.originalUrl} alt="元" className="w-full rounded-md" />
                    <figcaption className="mt-1 text-center text-xs text-slate-500">元の写真</figcaption>
                  </figure>
                  <figure>
                    {sel.outUrl && <img src={sel.outUrl} alt="補正後" className="w-full rounded-md" />}
                    <figcaption className="mt-1 text-center text-xs text-slate-500">補正後</figcaption>
                  </figure>
                </div>
                <div className="mt-3">
                  <Slider label="この1枚だけ明るさを微調整" value={sel.exposure} min={-1} max={1} step={0.05} onChange={(v) => setItems((prev) => prev.map((i) => (i.id === sel.id ? { ...i, exposure: v } : i)))} fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(2)} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {items.map((it, idx) => (
                <div key={it.id} className={`group relative overflow-hidden rounded-md border bg-white ${selected === it.id ? "border-brand-600 ring-2 ring-brand-100" : "border-slate-200"}`}>
                  <button className="block w-full" onClick={() => setSelected(it.id)}>
                    <img src={it.outUrl ?? it.originalUrl} alt={it.name} className="aspect-[4/3] w-full object-cover" />
                  </button>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500">
                    <span className="truncate">{idx + 1}. {it.name}</span>
                    <button className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => remove(it.id)} title="削除">✕</button>
                  </div>
                  {it.exposure !== 0 && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{it.exposure > 0 ? "+" : ""}{it.exposure.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="label">{label}</span>
        <span className="text-xs text-slate-500">{fmt(value)}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
