/**
 * 家具の部品表と自動配置（配置イメージ）。
 *
 * 方針（2026-10-02 富永承認）:
 *   - 部品は mm の実寸で持つ。寸法には出典と確認日をコメントで残す。
 *   - 「入る大きさなら置く、入らなければ置かない、縮めない」。
 *   - 扉の開き範囲・建具の前・既存の記号（浴槽・洗面台・車）・他の家具とは重ねない。
 *   - 図面には必ず「家具は配置イメージ」と注記する（planSheet.ts の PLAN_NOTES）。
 *
 * 座標はすべて建物座標（m、建物外形の左下が原点、x=右、y=奥）。
 * 家具 1 点は FurnitureItem { kind, x, y, rot } で、x, y は「回転後の外形の左下」、rot は背を向ける壁の向き
 *   0 = 底辺側（y 小）の壁に背を向ける、90 = 右（x 大）、180 = 奥（y 大）、270 = 左（x 小）
 */
import type { Building, Fixture, FurnitureItem, Room } from "./types";
import { wallThickness, DOOR_KINDS } from "./walls";
import { roomGroups } from "./roomGroups";

/** 部品 1 種。w は壁に沿う方向の幅、d は壁から前へ出る奥行（m） */
export type FurnitureSpec = {
  kind: string;
  label: string;
  w: number;
  d: number;
  /** 背の高い家具（窓の前に置かない） */
  tall?: boolean;
  /** 置き方の好み: corner=角から、center=壁の中央、any=どこでも */
  prefer: "corner" | "center" | "any";
  /** 寸法の出典（確認日 2026-10-02） */
  source: string;
};

/** 部品表（単位 m。コメントは mm） */
export const FURNITURE: Record<string, FurnitureSpec> = {
  // JIS S 1102:2017 住宅用普通ベッド 呼び寸法 幅 980 / 長さ 1950（シングル相当）。https://kikakurui.com/s/S1102-2017-01.html
  bed_single: { kind: "bed_single", label: "ベッド（シングル 980×1950）", w: 0.98, d: 1.95, prefer: "corner", source: "JIS S 1102:2017 呼び寸法 980×1950" },
  // JIS S 1102:2017 呼び寸法 幅 1400 / 長さ 1950（ダブル相当）
  bed_double: { kind: "bed_double", label: "ベッド（ダブル 1400×1950）", w: 1.4, d: 1.95, prefer: "corner", source: "JIS S 1102:2017 呼び寸法 1400×1950" },
  // 学習机の天板 1000×600 が目安。https://desk.shunoman.com/tenban_size/
  // 椅子の分（450）を奥行に足して 1000×1050 の範囲を取る
  desk: { kind: "desk", label: "机（1000×600）＋椅子", w: 1.0, d: 1.05, prefer: "center", source: "収納マン「学習机の天板サイズ 1000×600mm」" },
  // 4人用ダイニングテーブルの標準 幅1200×奥行800（1人あたり 幅600×奥行400）。https://sekikagu-shop.jp/blogs/article/diningtable_4psize
  // 椅子は 1 人分の幅 600 の中に収まる 450×450 とし、長辺側に 2 脚ずつ置く（椅子の寸法は 1 人分 600×400 からの【推定】）
  dining_4: { kind: "dining_4", label: "ダイニング 4人（テーブル 1200×800＋椅子）", w: 1.2, d: 0.8 + 0.45 * 2, prefer: "any", source: "関家具「4人用は幅120×奥行80cm が標準」" },
  // 2人掛けソファ 幅 1400〜1600・奥行 800〜900 が一般的。上限側を採用。https://aflat.asia/coordinate/guide/layout-plan/step2/sofa/two-seater/index.html
  sofa_2: { kind: "sofa_2", label: "ソファ 2人掛け（1600×850）", w: 1.6, d: 0.85, prefer: "center", source: "a.flat「2人掛けは幅140〜160、奥行80〜90cm」" },
  // ニトリ ローボードナイトロ 幅150 奥行42。https://www.nitori-net.jp/ec/product/5633303s/
  tv_board: { kind: "tv_board", label: "テレビ台（1500×420）", w: 1.5, d: 0.42, tall: true, prefer: "center", source: "ニトリ ローボードナイトロ 150×42×42cm" },
  // システムキッチン I 型の標準 間口 2550×奥行 650（LIXIL リシェルSI／ノクト）。https://suumo.jp/article/oyakudachi/oyaku/chumon/c_plan/system_kitchen_size/
  kitchen_i: { kind: "kitchen_i", label: "キッチン I型（2550×650）", w: 2.55, d: 0.65, tall: true, prefer: "corner", source: "LIXIL I型 2550×650（SUUMO 解説）" },
  // パナソニック NR-E457PX 600×699（幅×奥行）。https://panasonic.jp/reizo/products/NR-E457PX/spec.html
  fridge: { kind: "fridge", label: "冷蔵庫（600×699）", w: 0.6, d: 0.7, tall: true, prefer: "corner", source: "Panasonic NR-E457PX 600×699mm" },
  // TOTO ピュアレストQR 445×772（幅×奥行）。https://www.zuo-denki.co.jp/publics/index/300/
  toilet: { kind: "toilet", label: "便器（445×772）", w: 0.445, d: 0.772, prefer: "center", source: "TOTO ピュアレストQR 445×772mm" },
  // パナソニック ドラム式 LX シリーズ 639×732（幅×奥行）。https://panasonic.jp/wash/check/dimensions.html
  washer: { kind: "washer", label: "洗濯機 ドラム式（639×732）", w: 0.64, d: 0.73, tall: true, prefer: "corner", source: "Panasonic NA-LX129F 639×732mm" },
  // ニトリ シューズボックス 幅80cm。奥行はカタログで 35〜45cm の幅があるため 400 を【仮置き】。https://item.rakuten.co.jp/nitori/0620300-/
  shoebox: { kind: "shoebox", label: "下駄箱（800×400）", w: 0.8, d: 0.4, tall: true, prefer: "corner", source: "ニトリ シューズボックス 幅80（奥行は 35〜45cm の範囲から仮置き）" },
};

/** 部屋タイプごとに置く順番（前から試し、入らないものは飛ばす） */
const PLAN_BY_TYPE: Record<string, string[]> = {
  bedroom: ["bed_double|bed_single", "desk"],
  study: ["desk"],
  ldk: ["kitchen_i", "fridge", "dining_4", "sofa_2", "tv_board"],
  living: ["sofa_2", "tv_board"],
  kitchen: ["kitchen_i", "fridge"],
  toilet: ["toilet"],
  washroom: ["washer"],
  entrance: ["shoebox"],
};

export type Rect = { x0: number; y0: number; x1: number; y1: number };
type Obstacle = Rect & { tallOnly?: boolean; kind: "door" | "clear" | "window" | "symbol" | "furniture" };

const EPS = 1e-6;
const inter = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
const inside = (a: Rect, b: Rect) => a.x0 >= b.x0 - EPS && a.y0 >= b.y0 - EPS && a.x1 <= b.x1 + EPS && a.y1 <= b.y1 + EPS;
const clip = (a: Rect, b: Rect): Rect | null => {
  const r = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return r.x1 > r.x0 + EPS && r.y1 > r.y0 + EPS ? r : null;
};
const roomRect = (r: Room): Rect => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.d });

/** 回転後の外形（建物座標） */
export function furnitureRect(it: Pick<FurnitureItem, "kind" | "x" | "y" | "rot">): Rect | null {
  const s = FURNITURE[it.kind];
  if (!s) return null;
  const vert = it.rot === 90 || it.rot === 270;
  const w = vert ? s.d : s.w, d = vert ? s.w : s.d;
  return { x0: it.x, y0: it.y, x1: it.x + w, y1: it.y + d };
}

/** 建具のまわりの「物を置かない範囲」 */
export function fixtureObstacles(fixtures: Fixture[], room: Rect, roomType?: string): Obstacle[] {
  const out: Obstacle[] = [];
  // 出入口の前は 600mm 空ける（通行のための目安、【仮置き】）。トイレは便器が目的地なので空きを求めない（扉の開き範囲だけ避ける）
  const CLEAR = roomType === "toilet" ? 0 : 0.6;
  for (const fx of fixtures) {
    const isDoor = DOOR_KINDS.includes(fx.kind);
    const isWin = fx.kind === "window" || fx.kind === "window_terrace" || fx.kind === "window_small";
    const isPass = isDoor || fx.kind === "sliding_single" || fx.kind === "sliding_double" || fx.kind === "folding" || fx.kind === "opening";
    // 建具の線分（壁の上）
    const a = fx.along === "h" ? { x0: fx.x, y0: fx.y, x1: fx.x + fx.width, y1: fx.y } : { x0: fx.x, y0: fx.y, x1: fx.x, y1: fx.y + fx.width };
    // 部屋の壁の上にある建具だけを見る（壁線に接しているか）
    const onRoom = fx.along === "h" ? (Math.abs(a.y0 - room.y0) < EPS || Math.abs(a.y0 - room.y1) < EPS) && a.x1 > room.x0 + EPS && a.x0 < room.x1 - EPS : (Math.abs(a.x0 - room.x0) < EPS || Math.abs(a.x0 - room.x1) < EPS) && a.y1 > room.y0 + EPS && a.y0 < room.y1 - EPS;
    if (!onRoom) continue;
    // 建具の両側に帯を作り、部屋の中に入る部分だけ残す
    const band = (depth: number): Rect => (fx.along === "h" ? { x0: a.x0, y0: a.y0 - depth, x1: a.x1, y1: a.y0 + depth } : { x0: a.x0 - depth, y0: a.y0, x1: a.x0 + depth, y1: a.y1 });
    if (isPass && CLEAR > 0) {
      const c = clip(band(CLEAR), room);
      if (c) out.push({ ...c, kind: "clear" });
    }
    if (isDoor) {
      // 開き戸: 吊元を中心にした「幅×幅」の正方形（開いた扇形を含む範囲）
      const leaf = fx.kind === "door_parent_child" ? fx.width * 0.66 : fx.width;
      const hingeAtEnd = fx.hinge === "end";
      const sgn = fx.swing === "minus" ? -1 : 1;
      let sq: Rect;
      if (fx.along === "h") {
        const hx = hingeAtEnd ? fx.x + fx.width : fx.x;
        const x0 = hingeAtEnd ? hx - leaf : hx;
        sq = { x0, x1: x0 + leaf, y0: sgn > 0 ? fx.y : fx.y - leaf, y1: sgn > 0 ? fx.y + leaf : fx.y };
      } else {
        const hy = hingeAtEnd ? fx.y + fx.width : fx.y;
        const y0 = hingeAtEnd ? hy - leaf : hy;
        sq = { y0, y1: y0 + leaf, x0: sgn > 0 ? fx.x : fx.x - leaf, x1: sgn > 0 ? fx.x + leaf : fx.x };
      }
      const c = clip(sq, room);
      if (c) out.push({ ...c, kind: "door" });
    }
    if (isWin) {
      // 窓の前 300mm には背の高い家具を置かない（ベッド・ソファは可）
      const c = clip(band(0.3), room);
      if (c) out.push({ ...c, kind: "window", tallOnly: true });
    }
  }
  return out;
}

/** 既に描いている記号（浴槽・洗面台・車）の範囲。PlanParts の描き方に合わせる */
export function symbolObstacles(r: Room): Obstacle[] {
  const R = roomRect(r);
  const out: Obstacle[] = [];
  if (r.type === "bath") {
    const horiz = r.w >= r.d;
    const tw = horiz ? Math.min(r.w - 0.1, 1.6) : Math.min(0.75, r.w - 0.1);
    const th = horiz ? Math.min(0.75, r.d - 0.1) : Math.min(r.d - 0.1, 1.6);
    out.push({ x0: R.x0, y0: R.y1 - th, x1: R.x0 + tw, y1: R.y1, kind: "symbol" });
  }
  if (r.type === "washroom") {
    const v = (r.vanity ?? (Math.max(r.w, r.d) >= 1.8 ? 1650 : 750)) / 1000;
    const horiz = r.w >= v + 0.1;
    const bw = horiz ? Math.min(v, r.w - 0.1) : 0.6, bh = horiz ? 0.6 : Math.min(v, r.d - 0.1);
    out.push({ x0: R.x0, y0: R.y1 - bh, x1: R.x0 + bw, y1: R.y1, kind: "symbol" });
  }
  if (r.type === "garage") {
    const vert = r.d >= r.w;
    const cw = vert ? 1.8 : 4.7, ch = vert ? 4.7 : 1.8;
    if (cw <= r.w - 0.07 && ch <= r.d - 0.07) out.push({ x0: R.x0 + (r.w - cw) / 2, y0: R.y0 + (r.d - ch) / 2, x1: R.x0 + (r.w + cw) / 2, y1: R.y0 + (r.d + ch) / 2, kind: "symbol" });
  }
  return out;
}

/** 壁ごとに、壁沿いを少しずつずらした候補を作る（角・中央を優先しつつ、障害物を避けて入る位置を探せるように） */
type Cand = { x: number; y: number; rot: FurnitureItem["rot"]; wall: "S" | "N" | "W" | "E"; at: "corner" | "center"; slide: number };
function candidates(spec: FurnitureSpec, inner: Rect): Cand[] {
  const out: Cand[] = [];
  const W = inner.x1 - inner.x0, D = inner.y1 - inner.y0;
  const STEP = 0.0455;
  // 壁の長さ L に幅 size を置くときの、壁に沿った位置の候補（0 〜 L−size）
  const along = (L: number, size: number): { t: number; at: "corner" | "center"; slide: number }[] => {
    const max = L - size;
    if (max < -EPS) return [];
    const list: { t: number; at: "corner" | "center"; slide: number }[] = [];
    const n = Math.floor(max / STEP + EPS);
    for (let i = 0; i <= n; i++) {
      const t = i * STEP;
      const dEnd = Math.min(t, max - t), dMid = Math.abs(t - max / 2);
      list.push({ t, at: dEnd < 0.1 ? "corner" : dMid < 0.1 ? "center" : "corner", slide: Math.min(dEnd, dMid) });
    }
    if (max - n * STEP > EPS) list.push({ t: max, at: "corner", slide: 0 });
    return list;
  };
  // 底辺側・奥側の壁（背を y 小／y 大へ）: 外形 w×d
  if (spec.w <= W + EPS && spec.d <= D + EPS)
    for (const a of along(W, spec.w)) {
      out.push({ x: inner.x0 + a.t, y: inner.y0, rot: 0, wall: "S", at: a.at, slide: a.slide });
      out.push({ x: inner.x0 + a.t, y: inner.y1 - spec.d, rot: 180, wall: "N", at: a.at, slide: a.slide });
    }
  // 左右の壁（背を x 小／x 大へ）: 外形 d×w
  if (spec.d <= W + EPS && spec.w <= D + EPS)
    for (const a of along(D, spec.w)) {
      out.push({ x: inner.x0, y: inner.y0 + a.t, rot: 270, wall: "W", at: a.at, slide: a.slide });
      out.push({ x: inner.x1 - spec.d, y: inner.y0 + a.t, rot: 90, wall: "E", at: a.at, slide: a.slide });
    }
  return out;
}

export type PlaceResult = { items: FurnitureItem[]; skipped: { room: string; kind: string }[] };

/**
 * 1 階分の家具を自動配置する。保存済み（room.furniture）がある部屋はそれを使い、無い部屋だけ自動で置く。
 * 同じ group の部屋（L 字の LDK）はまとめて 1 つの部屋として扱い、各矩形に順に置いていく。
 */
export function autoFurniture(b: Building, rooms: Room[], fixtures: Fixture[], newId: () => string = defaultId): PlaceResult {
  const wt = wallThickness(b);
  const items: FurnitureItem[] = [];
  const skipped: { room: string; kind: string }[] = [];
  const placedRects: Rect[] = [];
  // 既に保存されている家具は固定
  for (const r of rooms) for (const it of r.furniture ?? []) { const rc = furnitureRect(it); if (rc) { items.push(it); placedRects.push(rc); } }

  for (const group of roomGroups(rooms)) {
    const lead = group[0];
    if (group.some((r) => r.furniture)) continue; // 保存済みの部屋には触らない
    const plan = PLAN_BY_TYPE[lead.type];
    if (!plan) continue;
    const rects = group.map((r) => ({ room: r, R: roomRect(r) }));
    // 部屋ごとの障害物（建具・記号）。半壁厚だけ内側に寄せた「置ける範囲」も作る
    const ctx = rects.map(({ room, R }) => {
      const half = wt.int / 2 + 0.01;
      const inner: Rect = { x0: R.x0 + half, y0: R.y0 + half, x1: R.x1 - half, y1: R.y1 - half };
      const obs: Obstacle[] = [...fixtureObstacles(fixtures, R, room.type), ...symbolObstacles(room)];
      return { room, R, inner, obs };
    });
    // 壁ごとの建具の数（少ない壁を好む）
    const wallScore = (R: Rect, wall: "S" | "N" | "W" | "E") =>
      fixtures.filter((fx) => {
        if (fx.along === "h" && (wall === "S" || wall === "N")) return Math.abs(fx.y - (wall === "S" ? R.y0 : R.y1)) < EPS && fx.x + fx.width > R.x0 + EPS && fx.x < R.x1 - EPS;
        if (fx.along === "v" && (wall === "W" || wall === "E")) return Math.abs(fx.x - (wall === "W" ? R.x0 : R.x1)) < EPS && fx.y + fx.width > R.y0 + EPS && fx.y < R.y1 - EPS;
        return false;
      }).length;

    let lastWall: { wall: "S" | "N" | "W" | "E"; rect: Rect } | null = null;
    for (const step of plan) {
      const options = step.split("|");
      let placed = false;
      for (const kind of options) {
        const spec = FURNITURE[kind];
        if (!spec) continue;
        type Scored = { x: number; y: number; rot: FurnitureItem["rot"]; score: number; rc: Rect };
        const cands: Scored[] = [];
        for (const c of ctx) {
          for (const cd of candidates(spec, c.inner)) {
            const rc = furnitureRect({ kind, x: cd.x, y: cd.y, rot: cd.rot })!;
            if (!inside(rc, c.inner)) continue;
            if (c.obs.some((o) => (!o.tallOnly || spec.tall) && inter(rc, o))) continue;
            if (placedRects.some((p) => inter(rc, p))) continue;
            let score = 0;
            score -= wallScore(c.R, cd.wall) * 10;
            // 角が好みなら角に近いほど、中央が好みなら中央に近いほど高い点（slide は好みの位置からのずれ m）
            const wantCorner = spec.prefer === "corner" || (spec.prefer === "any" && cd.at === "corner");
            const wantCenter = spec.prefer === "center";
            if (wantCorner && cd.at === "corner") score += 3 - Math.min(3, cd.slide * 4);
            if (wantCenter && cd.at === "center") score += 3 - Math.min(3, cd.slide * 4);
            if (!wantCorner && !wantCenter) score += 1 - Math.min(1, cd.slide);
            // 冷蔵庫はキッチンと同じ壁に、テレビ台はソファの向かいに
            if (kind === "fridge" && lastWall && lastWall.wall === cd.wall && inter({ ...c.R }, lastWall.rect) ) score += 6;
            if (kind === "tv_board" && lastWall) {
              const opp = { S: "N", N: "S", W: "E", E: "W" }[lastWall.wall];
              if (cd.wall === opp) score += 8; else score -= 20;
            }
            // 便器は入口の反対の壁（建具が無い壁）に
            if (kind === "toilet") score += cd.at === "center" ? 2 : 0;
            cands.push({ x: cd.x, y: cd.y, rot: cd.rot, score, rc });
          }
        }
        if (!cands.length) continue;
        cands.sort((p, q) => q.score - p.score);
        const best = cands[0];
        const it: FurnitureItem = { id: newId(), kind, x: +best.x.toFixed(3), y: +best.y.toFixed(3), rot: best.rot };
        items.push(it);
        placedRects.push(best.rc);
        const wallOf = (rot: number) => (rot === 0 ? "S" : rot === 180 ? "N" : rot === 270 ? "W" : "E") as "S" | "N" | "W" | "E";
        if (kind === "kitchen_i" || kind === "sofa_2") lastWall = { wall: wallOf(best.rot), rect: best.rc };
        placed = true;
        break;
      }
      if (!placed) skipped.push({ room: lead.name, kind: options[0] });
    }
  }
  return { items, skipped };
}

function defaultId() {
  return "f" + Math.random().toString(36).slice(2, 8);
}

/**
 * 検査: 家具が部屋の中に収まり、扉の開き・出入口の前・記号・他の家具と重なっていないか。
 * 問題があれば日本語の説明を返す（空配列なら合格）。scripts/plansheet-check.ts と画面の両方で使う。
 */
export function checkFurniture(b: Building, rooms: Room[], fixtures: Fixture[], items: FurnitureItem[]): string[] {
  const wt = wallThickness(b);
  const issues: string[] = [];
  const rects = items.map((it) => ({ it, rc: furnitureRect(it) }));
  for (const { it, rc } of rects) {
    if (!rc) { issues.push(`${it.kind}: 部品表に無い種類です`); continue; }
    const room = rooms.find((r) => inside(rc, { x0: r.x - EPS, y0: r.y - EPS, x1: r.x + r.w + EPS, y1: r.y + r.d + EPS }));
    if (!room) { issues.push(`${FURNITURE[it.kind].label}: どの部屋にも収まっていません`); continue; }
    const R = roomRect(room);
    const half = wt.int / 2;
    const inner: Rect = { x0: R.x0 + half, y0: R.y0 + half, x1: R.x1 - half, y1: R.y1 - half };
    if (!inside(rc, inner)) issues.push(`${room.name} の ${FURNITURE[it.kind].label}: 壁の厚みにかかっています`);
    for (const o of [...fixtureObstacles(fixtures, R, room.type), ...symbolObstacles(room)]) {
      if (o.tallOnly && !FURNITURE[it.kind].tall) continue;
      if (inter(rc, o)) issues.push(`${room.name} の ${FURNITURE[it.kind].label}: ${o.kind === "door" ? "扉の開き範囲" : o.kind === "clear" ? "出入口の前" : o.kind === "window" ? "窓の前" : "浴槽・洗面台・車の記号"}と重なっています`);
    }
  }
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].rc, c = rects[j].rc;
      if (a && c && inter(a, c)) issues.push(`${FURNITURE[rects[i].it.kind].label} と ${FURNITURE[rects[j].it.kind].label} が重なっています`);
    }
  return issues;
}
