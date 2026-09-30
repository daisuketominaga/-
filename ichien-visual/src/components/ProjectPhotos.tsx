"use client";

import { useState } from "react";
import type { Project, ProjectPhoto } from "@/lib/types";
import { uid } from "@/lib/store";

type Props = { project: Project; setProject: (u: (p: Project) => Project) => void; readOnly?: boolean };

export const PHOTO_KIND: Record<ProjectPhoto["kind"], string> = { exterior: "外観", interior: "室内", around: "周辺", other: "その他" };
const MAX_PHOTOS = 16;

/** 画像を長辺 1200px・JPEG 品質 0.8 に縮小して data URL にする（物件データと一緒にクラウドへ保存できる大きさ） */
async function shrinkFile(file: File | Blob, max = 1200): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("画像を開けません")); img.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 外観/室内/周辺 を、明るさやファイル名から推定（EXIF は読まない）。あくまで初期値 */
function guessKind(name: string): ProjectPhoto["kind"] {
  const n = name.toLowerCase();
  if (/(gaikan|exterior|外観|front)/.test(n)) return "exterior";
  if (/(shunai|interior|室内|ldk|room|kitchen|bath)/.test(n)) return "interior";
  if (/(shuhen|around|周辺|station|eki|park)/.test(n)) return "around";
  return "other";
}

/** 物件に紐づく写真。縮小して保存し、提案書の写真ページに出す */
export default function ProjectPhotos({ project, setProject, readOnly }: Props) {
  const photos = project.photos ?? [];
  const [busy, setBusy] = useState(false);
  const update = (id: string, patch: Partial<ProjectPhoto>) => setProject((p) => ({ ...p, photos: (p.photos ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const remove = (id: string) => setProject((p) => ({ ...p, photos: (p.photos ?? []).filter((x) => x.id !== id) }));
  const move = (id: string, dir: -1 | 1) =>
    setProject((p) => {
      const arr = [...(p.photos ?? [])];
      const i = arr.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return p;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...p, photos: arr };
    });

  const add = async (files: FileList | File[] | Blob[], names?: string[]) => {
    setBusy(true);
    try {
      const arr = Array.from(files as ArrayLike<File | Blob>);
      const room = MAX_PHOTOS - photos.length;
      const next: ProjectPhoto[] = [];
      for (let i = 0; i < Math.min(arr.length, room); i++) {
        const f = arr[i];
        const name = names?.[i] ?? (f as File).name ?? "";
        next.push({ id: uid(), kind: guessKind(name), dataUrl: await shrinkFile(f), caption: "", takenAt: (f as File).lastModified ? new Date((f as File).lastModified).toISOString().slice(0, 10) : undefined });
      }
      if (next.length) setProject((p) => ({ ...p, photos: [...(p.photos ?? []), ...next] }));
      if (arr.length > room) alert(`写真は ${MAX_PHOTOS} 枚までです（${arr.length - room} 枚は追加していません）`);
    } finally {
      setBusy(false);
    }
  };

  const groups = (["exterior", "interior", "around", "other"] as const).map((k) => ({ k, items: photos.filter((p) => p.kind === k) })).filter((g) => g.items.length);

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">この物件の写真（{photos.length}/{MAX_PHOTOS}）</h3>
            <p className="text-[11px] text-slate-500">長辺1200pxに縮小して物件データと一緒に保存します（クラウド保存にも入ります）。提案書の写真ページに出ます。</p>
          </div>
          <label className={`btn-primary cursor-pointer ${busy ? "opacity-50" : ""}`}>
            {busy ? "追加中…" : "写真を追加"}
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => e.target.files && add(e.target.files)} />
          </label>
        </div>
      )}
      {groups.length === 0 && <div className="text-xs text-slate-400">写真はまだありません。</div>}
      {groups.map((g) => (
        <div key={g.k}>
          <div className="mb-1 text-xs font-medium text-slate-600">{PHOTO_KIND[g.k]}（{g.items.length}）</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {g.items.map((ph) => (
              <div key={ph.id} className="space-y-1 rounded border border-slate-200 p-1 text-[11px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.dataUrl} alt={ph.caption || PHOTO_KIND[ph.kind]} className="aspect-[4/3] w-full rounded object-cover" />
                {readOnly ? (
                  <div className="truncate">{ph.caption}{ph.takenAt ? `　${ph.takenAt}` : ""}</div>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      <select className="field px-1 py-0.5" value={ph.kind} onChange={(e) => update(ph.id, { kind: e.target.value as ProjectPhoto["kind"] })}>
                        {(Object.keys(PHOTO_KIND) as ProjectPhoto["kind"][]).map((k) => <option key={k} value={k}>{PHOTO_KIND[k]}</option>)}
                      </select>
                      <input type="date" className="field px-1 py-0.5" value={ph.takenAt ?? ""} onChange={(e) => update(ph.id, { takenAt: e.target.value })} />
                    </div>
                    <input className="field px-1 py-0.5" placeholder="説明（例: 南側道路から）" value={ph.caption} onChange={(e) => update(ph.id, { caption: e.target.value })} />
                    <div className="flex justify-between">
                      <span><button className="btn-ghost px-1 py-0" onClick={() => move(ph.id, -1)}>←</button><button className="btn-ghost px-1 py-0" onClick={() => move(ph.id, 1)}>→</button></span>
                      <button className="text-red-500" onClick={() => remove(ph.id)}>削除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { shrinkFile as shrinkPhoto };
