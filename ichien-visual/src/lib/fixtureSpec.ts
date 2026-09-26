import type { FixtureKind, Project, Fixture } from "./types";
import { FIXTURE_LABEL } from "./types";

/**
 * 建具の標準仕様（建具表・見積の下書き用）。
 * 高さと参考品番はメーカーの規格寸法から。【推測】の付いたものは私（AI）が一般的な寸法として置いた値で、
 * 見積・発注の前にカタログで確認してください。
 */
export type FixtureSpec = {
  kind: FixtureKind;
  /** 記号の頭文字（建具表用） */
  symbol: string;
  /** 高さ mm */
  height: number;
  /** 取付高さ（床から下端）mm */
  sill: number;
  /** 参考品番・呼称（幅ごと） */
  ref: (widthMm: number) => string;
  /** 面材・仕様のメモ */
  spec: string;
  guessed?: boolean;
};

const sashName = (w: number, h: number) => {
  // サッシの呼称: 幅1690×高さ1170 → 16511、幅1690×高さ2030 → 16520 のように、幅3桁＋高さ2桁で呼ぶ慣例
  const table: Record<string, string> = {
    "1690x1170": "16511",
    "1690x2030": "16520",
    "1235x1170": "11911",
    "2550x2030": "25120",
    "640x770": "06007",
    "640x1170": "06011",
    "405x770": "04007",
    "780x770": "07407",
  };
  return table[`${w}x${h}`] ?? `${w}×${h}（呼称は要確認）`;
};

export const FIXTURE_SPECS: Record<FixtureKind, FixtureSpec> = {
  door_single: { kind: "door_single", symbol: "D", height: 2023, sill: 0, ref: (w) => `LIXIL ラシッサ 片開き W${w} H2023【推測】`, spec: "室内片開きドア・木目調", guessed: true },
  door_entrance: { kind: "door_entrance", symbol: "ED", height: 2330, sill: 0, ref: (w) => `LIXIL ジエスタ2 片開き W${w} H2330`, spec: "玄関ドア・断熱・防火設備（道路側）" },
  door_parent_child: { kind: "door_parent_child", symbol: "ED", height: 2330, sill: 0, ref: (w) => `LIXIL ジエスタ2 親子 W${w} H2330`, spec: "玄関ドア・断熱・防火設備" },
  sliding_single: { kind: "sliding_single", symbol: "SD", height: 2023, sill: 0, ref: (w) => `LIXIL ラシッサ 片引き戸 W${w} H2023`, spec: "室内片引き戸・上吊り" },
  sliding_double: { kind: "sliding_double", symbol: "SD", height: 2023, sill: 0, ref: (w) => `LIXIL ラシッサ 引違い戸 W${w} H2023【推測】`, spec: "室内引違い戸", guessed: true },
  folding: { kind: "folding", symbol: "CD", height: 2023, sill: 0, ref: (w) => `LIXIL ラシッサ 折れ戸 W${w} H2023【推測】`, spec: "クローゼット折れ戸", guessed: true },
  window: { kind: "window", symbol: "W", height: 1170, sill: 900, ref: (w) => `引違い窓 ${sashName(w, 1170)}`, spec: "アルミ樹脂複合・Low-E複層・網戸" },
  window_terrace: { kind: "window_terrace", symbol: "TW", height: 2030, sill: 0, ref: (w) => `引違いテラス戸 ${sashName(w, 2030)}`, spec: "アルミ樹脂複合・Low-E複層・網戸・シャッター要否確認" },
  window_small: { kind: "window_small", symbol: "SW", height: 770, sill: 1300, ref: (w) => `縦すべり出し窓 ${sashName(w, 770)}【推測】`, spec: "換気用・面格子要否確認", guessed: true },
  opening: { kind: "opening", symbol: "OP", height: 2200, sill: 0, ref: () => "開口（建具なし）", spec: "ガレージ等の開口・シャッター別途" },
};

export type ScheduleRow = {
  symbol: string;
  level: number;
  kind: FixtureKind;
  label: string;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  count: number;
  ref: string;
  spec: string;
  exterior: boolean;
  guessed: boolean;
};

/** 建具表: 階・種類・幅ごとにまとめ、記号を振る */
export function fixtureSchedule(project: Project): ScheduleRow[] {
  const b = project.building;
  const eps = 1e-6;
  const isExterior = (fx: Fixture) => (fx.along === "h" && (Math.abs(fx.y) < eps || Math.abs(fx.y - b.d) < eps)) || (fx.along === "v" && (Math.abs(fx.x) < eps || Math.abs(fx.x - b.w) < eps));
  const map = new Map<string, ScheduleRow>();
  for (const f of project.floors) {
    for (const fx of f.fixtures ?? []) {
      const spec = FIXTURE_SPECS[fx.kind];
      const w = Math.round(fx.width * 1000);
      const key = `${f.level}|${fx.kind}|${w}`;
      const cur = map.get(key);
      if (cur) { cur.count++; continue; }
      map.set(key, { symbol: "", level: f.level, kind: fx.kind, label: FIXTURE_LABEL[fx.kind], widthMm: w, heightMm: spec.height, sillMm: spec.sill, count: 1, ref: spec.ref(w), spec: spec.spec, exterior: isExterior(fx), guessed: !!spec.guessed });
    }
  }
  // 記号: 種類ごとに通し番号（階をまたいで同じ幅なら同じ記号）
  const rows = Array.from(map.values()).sort((a, c) => a.level - c.level || a.kind.localeCompare(c.kind) || a.widthMm - c.widthMm);
  const numbering = new Map<string, string>();
  const counters = new Map<string, number>();
  for (const r of rows) {
    const sym = FIXTURE_SPECS[r.kind].symbol;
    const k = `${sym}|${r.kind}|${r.widthMm}`;
    if (!numbering.has(k)) {
      const n = (counters.get(sym) ?? 0) + 1;
      counters.set(sym, n);
      numbering.set(k, `${sym}${n}`);
    }
    r.symbol = numbering.get(k)!;
  }
  return rows;
}

export function scheduleCsv(rows: ScheduleRow[]): string {
  const head = ["記号", "階", "種類", "幅(mm)", "高さ(mm)", "取付高さ(mm)", "数量", "外部/内部", "参考品番", "仕様"];
  const lines = rows.map((r) => [r.symbol, `${r.level}F`, r.label, r.widthMm, r.heightMm, r.sillMm, r.count, r.exterior ? "外部" : "内部", r.ref, r.spec].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  return "﻿" + [head.join(","), ...lines].join("\n");
}
