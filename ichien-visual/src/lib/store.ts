"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "./types";
import { sampleProject } from "./sample";

const KEY = "ichien-visual-project-v1";

export function useProject() {
  const [project, setProjectState] = useState<Project | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Project;
        if (!p.grid) p.grid = { baseEdge: 0, u: 0.91, v: 0.91 };
        setProjectState(p);
        return;
      }
    } catch {
      /* ignore */
    }
    setProjectState(sampleProject());
  }, []);

  const setProject = useCallback((updater: (p: Project) => Project) => {
    setProjectState((prev) => {
      const base = prev ?? sampleProject();
      const next = { ...updater(base), updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const replaceProject = useCallback((p: Project) => {
    setProject(() => p);
  }, [setProject]);

  return { project, setProject, replaceProject };
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

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
