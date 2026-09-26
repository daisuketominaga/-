"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "./types";
import { sampleProject, emptyProject, lessonProject1, lessonProject2, lessonProject3 } from "./sample";
import { queueCloudUpsert, cloudList, cloudUpsert, cloudDelete, cloudSession } from "./cloud";

const LEGACY_KEY = "ichien-visual-project-v1";
const INDEX_KEY = "ichien-visual-projects-v1";
const itemKey = (id: string) => `ichien-visual-project:${id}`;

export type ProjectMeta = { id: string; name: string; updatedAt: string };
type Index = { currentId: string; list: ProjectMeta[] };

function readIndex(): Index | null {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Index) : null;
  } catch {
    return null;
  }
}
function writeIndex(ix: Index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(ix));
  } catch {
    /* ignore */
  }
}
/** 以前の保存で 0.46 / 0.905 のように丸まってしまった値を 455mm 刻みに戻す */
function fixGrid(v: number) {
  const s = Math.round(v / 0.455) * 0.455;
  return Math.abs(v - s) < 0.011 ? Math.round(s * 1000) / 1000 : v;
}
export function normalizeProject(p: Project): Project {
  if (!p.grid) p.grid = { baseEdge: 0, u: 0.91, v: 0.91 };
  if (!p.openings) p.openings = [];
  p.floors = (p.floors ?? []).map((f) => ({
    ...f,
    rooms: (f.rooms ?? []).map((r) => ({ ...r, x: fixGrid(r.x), y: fixGrid(r.y), w: fixGrid(r.w), d: fixGrid(r.d) })),
    fixtures: (f.fixtures ?? []).map((x) => ({ ...x, x: fixGrid(x.x), y: fixGrid(x.y) })),
  }));
  return p;
}
function readProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(itemKey(id));
    if (!raw) return null;
    return normalizeProject(JSON.parse(raw) as Project);
  } catch {
    return null;
  }
}
function writeProject(id: string, p: Project) {
  try {
    localStorage.setItem(itemKey(id), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function useProject() {
  const [project, setProjectState] = useState<Project | null>(null);
  const [currentId, setCurrentId] = useState<string>("");
  const [list, setList] = useState<ProjectMeta[]>([]);

  // 初回: 一覧を読み込む。無ければ旧形式から移行、それも無ければサンプルを作る
  useEffect(() => {
    let ix = readIndex();
    if (!ix || ix.list.length === 0) {
      const id = uid();
      let p: Project | null = null;
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (raw) p = JSON.parse(raw) as Project;
      } catch {
        /* ignore */
      }
      if (!p) p = sampleProject();
      if (!p.grid) p.grid = { baseEdge: 0, u: 0.91, v: 0.91 };
      if (!p.openings) p.openings = [];
      writeProject(id, p);
      ix = { currentId: id, list: [{ id, name: p.name, updatedAt: p.updatedAt }] };
      writeIndex(ix);
    }
    const cur = readProject(ix.currentId) ?? readProject(ix.list[0].id) ?? sampleProject();
    const curId = readProject(ix.currentId) ? ix.currentId : ix.list[0].id;
    setCurrentId(curId);
    setList(ix.list);
    setProjectState(cur);
  }, []);

  const persist = useCallback((id: string, next: Project) => {
    writeProject(id, next);
    const ix = readIndex() ?? { currentId: id, list: [] };
    const meta = { id, name: next.name, updatedAt: next.updatedAt };
    const exists = ix.list.some((m) => m.id === id);
    const newList = exists ? ix.list.map((m) => (m.id === id ? meta : m)) : [...ix.list, meta];
    writeIndex({ currentId: id, list: newList });
    setList(newList);
    queueCloudUpsert(id, next);
  }, []);

  const setProject = useCallback(
    (updater: (p: Project) => Project) => {
      setProjectState((prev) => {
        const base = prev ?? sampleProject();
        const next = { ...updater(base), updatedAt: new Date().toISOString() };
        if (currentId) persist(currentId, next);
        return next;
      });
    },
    [currentId, persist]
  );

  const replaceProject = useCallback((p: Project) => setProject(() => p), [setProject]);

  /** 別の物件へ切り替える */
  const switchTo = useCallback((id: string) => {
    const p = readProject(id);
    if (!p) return;
    setCurrentId(id);
    setProjectState(p);
    const ix = readIndex();
    if (ix) writeIndex({ ...ix, currentId: id });
  }, []);

  /** 新しい物件を作って切り替える */
  const createProject = useCallback(
    (kind: "empty" | "sample" | "copy" | "lesson1" | "lesson2" | "lesson3") => {
      const id = uid();
      const base = kind === "sample" ? sampleProject() : kind === "lesson1" ? lessonProject1() : kind === "lesson2" ? lessonProject2() : kind === "lesson3" ? lessonProject3() : kind === "copy" && project ? { ...project, name: project.name + "（コピー）" } : emptyProject();
      const p = { ...base, updatedAt: new Date().toISOString() };
      persist(id, p);
      setCurrentId(id);
      setProjectState(p);
      const ix = readIndex();
      if (ix) writeIndex({ ...ix, currentId: id });
    },
    [persist, project]
  );

  /** 物件を削除する。最後の1件は削除できない */
  const deleteProject = useCallback(
    (id: string) => {
      const ix = readIndex();
      if (!ix || ix.list.length <= 1) return;
      try {
        localStorage.removeItem(itemKey(id));
      } catch {
        /* ignore */
      }
      const newList = ix.list.filter((m) => m.id !== id);
      const nextId = id === ix.currentId ? newList[0].id : ix.currentId;
      writeIndex({ currentId: nextId, list: newList });
      setList(newList);
      cloudSession().then((s) => {
        if (s) cloudDelete(id, s.user.email ?? null).catch(() => {});
      });
      if (id === currentId) {
        const p = readProject(nextId);
        setCurrentId(nextId);
        if (p) setProjectState(p);
      }
    },
    [currentId]
  );

  /**
   * クラウドと同期する。新しい方（updatedAt が後）を採用し、片方にしか無いものは相手に送る。
   * クラウドで削除済み（deleted_at あり）のものは、ローカルの更新がそれより古ければローカルからも消す。
   */
  const cloudSync = useCallback(async (): Promise<{ pulled: number; pushed: number; removed: number }> => {
    const s = await cloudSession();
    if (!s) throw new Error("ログインしていません");
    const email = s.user.email ?? null;
    const rows = await cloudList();
    const ix = readIndex() ?? { currentId: "", list: [] };
    let list = [...ix.list];
    let pulled = 0,
      pushed = 0,
      removed = 0;
    const seen = new Set<string>();
    for (const r of rows) {
      seen.add(r.id);
      const local = readProject(r.id);
      const localAt = list.find((m) => m.id === r.id)?.updatedAt ?? local?.updatedAt ?? "";
      if (r.deleted_at) {
        if (local && localAt <= r.updated_at) {
          try {
            localStorage.removeItem(itemKey(r.id));
          } catch {
            /* ignore */
          }
          list = list.filter((m) => m.id !== r.id);
          removed++;
        } else if (local) {
          await cloudUpsert(r.id, local, email);
          pushed++;
        }
        continue;
      }
      if (!local || localAt < r.updated_at) {
        const p = normalizeProject({ ...r.data, updatedAt: r.updated_at });
        writeProject(r.id, p);
        const meta = { id: r.id, name: p.name, updatedAt: r.updated_at };
        list = list.some((m) => m.id === r.id) ? list.map((m) => (m.id === r.id ? meta : m)) : [...list, meta];
        pulled++;
      } else if (localAt > r.updated_at) {
        await cloudUpsert(r.id, local, email);
        pushed++;
      }
    }
    for (const m of ix.list) {
      if (seen.has(m.id)) continue;
      const local = readProject(m.id);
      if (local) {
        await cloudUpsert(m.id, local, email);
        pushed++;
      }
    }
    if (!list.length) {
      const id = uid();
      const p = sampleProject();
      writeProject(id, p);
      list = [{ id, name: p.name, updatedAt: p.updatedAt }];
    }
    const curId = list.some((m) => m.id === ix.currentId) ? ix.currentId : list[0].id;
    writeIndex({ currentId: curId, list });
    setList(list);
    setCurrentId(curId);
    const cur = readProject(curId);
    if (cur) setProjectState(cur);
    return { pulled, pushed, removed };
  }, []);

  return { project, setProject, replaceProject, list, currentId, switchTo, createProject, deleteProject, cloudSync };
}

export function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** SVG要素をPNGとしてダウンロード */
export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string, scale = 3) {
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg load failed"));
    img.src = url;
  });
  const vb = svg.viewBox.baseVal;
  const w = (vb && vb.width) || svg.clientWidth;
  const h = (vb && vb.height) || svg.clientHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
}
