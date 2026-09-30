// 藤沢市鵠沼松が岡4丁目 2階建てプラン: 敷地図・立面図・間取り図をデザイン仕上げで描く
// node scripts/design/plan-a.mjs <outdir>
import { chromium } from "playwright";
import fs from "node:fs";
const out = process.argv[2] ?? "/tmp/design";
fs.mkdirSync(out, { recursive: true });

const FONT = "'IPAPGothic','IPAGothic','Noto Sans JP',sans-serif";
const INK = "#1c2430", WALL = "#161a1f", WOOD = "#e6c9a3", WOOD2 = "#d7b58c", TILE = "#dfeaf3", TILE2 = "#cfe0ee", GLASS = "#b9d4e8", GLASS2 = "#9fc3de", DARK = "#232a33", FRAME = "#8a5a2b", FOUND = "#5c6570";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* ---------------- ページ1: 敷地図 ---------------- */
function sitePage() {
  // 底辺 P4→P1 を下、道路（P1–P2）を左に置く。単位 m
  const P = { P1: [0, 0], P2: [-0.01, 8.15], P3: [12.75, 7.59], P4: [12.42, 0] };
  const S = 78; // px / m
  const ox = 330, oy = 80 + 8.5 * S; // 原点(P1)の画面位置。y は上向き
  const X = (x) => ox + x * S, Y = (y) => oy - y * S;
  const poly = ["P1", "P2", "P3", "P4"].map((k) => `${X(P[k][0])},${Y(P[k][1])}`).join(" ");
  const dim = (a, b, label, off, side = 1) => {
    // a,b: [x,y] m。off: 図形から離す距離 px。線と両端のティック
    const ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]);
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const nx = (-dy / L) * side, ny = (dx / L) * side; // 法線
    const x1 = ax + nx * off, y1 = ay + ny * off, x2 = bx + nx * off, y2 = by + ny * off;
    const mx = (x1 + x2) / 2 + nx * 16, my = (y1 + y2) / 2 + ny * 16;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const rot = ang > 90 || ang < -90 ? ang + 180 : ang;
    return `<g stroke="${INK}" stroke-width="1.2" fill="none">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <line x1="${ax + nx * 6}" y1="${ay + ny * 6}" x2="${x1 + nx * 6}" y2="${y1 + ny * 6}" stroke-width="0.8"/>
      <line x1="${bx + nx * 6}" y1="${by + ny * 6}" x2="${x2 + nx * 6}" y2="${y2 + ny * 6}" stroke-width="0.8"/>
      <path d="M${x1},${y1} l7,-3 v6 z M${x2},${y2} l-7,-3 v6 z" fill="${INK}" stroke="none" transform="rotate(${ang} ${x1} ${y1})" opacity="0"/>
    </g>
    <text x="${mx}" y="${my}" font-size="22" fill="${INK}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${mx} ${my})" font-family="${FONT}">${label}</text>`;
  };
  // 道路（左側、斜めのハッチ）
  const roadW = 4.0 * S;
  const road = `<g>
    <polygon points="${X(-0.35) - roadW},${Y(11)} ${X(-0.35)},${Y(11)} ${X(0.05)},${Y(-2.2)} ${X(0.05) - roadW},${Y(-2.2)}" fill="#e6e9ee"/>
    ${Array.from({ length: 9 }, (_, i) => { const y = Y(11) + i * 118; return `<line x1="${X(-0.35) - roadW}" y1="${y}" x2="${X(0.05)}" y2="${y - 4}" stroke="#c9cfd8" stroke-width="1"/>`; }).join("")}
    <text x="${X(-0.15) - roadW / 2}" y="${Y(6.9)}" font-size="34" font-weight="700" fill="${INK}" text-anchor="middle" font-family="${FONT}">約5.0m</text>
    <text x="${X(-0.15) - roadW / 2}" y="${Y(6.2)}" font-size="26" fill="${INK}" text-anchor="middle" font-family="${FONT}">道路及び水路</text>
    <line x1="${X(-0.35) - roadW + 10}" y1="${Y(7.4)}" x2="${X(0.02) - 10}" y2="${Y(7.4)}" stroke="${INK}" stroke-width="1.5" marker-start="url(#ar)" marker-end="url(#ar)"/>
    <text x="${X(-0.15) - roadW / 2}" y="${Y(3.0)}" font-size="26" fill="${INK}" text-anchor="middle" font-family="${FONT}" writing-mode="tb" letter-spacing="4">法42条1項1号</text>
  </g>`;
  const pts = Object.entries(P).map(([k, [x, y]]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/>`).join("");
  const compass = `<g transform="translate(1250,150) rotate(40)">
    <circle r="42" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M0,-40 L12,12 L0,4 L-12,12 Z" fill="${INK}"/>
    <path d="M0,-40 L-12,12 L0,4 Z" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
    <text y="-52" font-size="26" font-weight="700" text-anchor="middle" fill="${INK}" font-family="${FONT}">N</text>
  </g>`;
  return `<svg viewBox="0 0 1400 990" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
    <defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="${INK}"/></marker></defs>
    <rect width="1400" height="990" fill="#fff"/>
    ${road}
    <rect x="40" y="26" width="470" height="46" fill="#fff" opacity="0.92"/>
    <text x="60" y="58" font-size="26" font-weight="700" fill="${INK}">藤沢市鵠沼松が岡4丁目　敷地図</text>
    <polygon points="${poly}" fill="#f5e9d3" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    ${pts}
    ${dim(P.P2, P.P3, "12.76m", 34, -1)}
    ${dim(P.P4, P.P1, "12.42m", 34, -1)}
    ${dim(P.P1, P.P2, "8.15m", 34, -1)}
    ${dim(P.P3, P.P4, "7.60m", 34, -1)}
    <text x="${X(6.3)}" y="${Y(4.5)}" font-size="64" font-weight="700" fill="${INK}" text-anchor="middle">99.17m²</text>
    <line x1="${X(4.4)}" y1="${Y(4.1)}" x2="${X(8.2)}" y2="${Y(4.1)}" stroke="${INK}" stroke-width="1.5"/>
    <text x="${X(6.3)}" y="${Y(3.3)}" font-size="40" fill="${INK}" text-anchor="middle">(30.00坪)</text>
    <text x="${X(6.2)}" y="${Y(8.75)}" font-size="16" fill="#555" text-anchor="middle">上辺は道水路に接する</text>
    ${compass}
    <text x="60" y="960" font-size="14" fill="#666">※測量図をもとにした参考図。寸法・面積は登記および確定測量によります。</text>
  </svg>`;
}

/* ---------------- 建物データ ---------------- */
const B = { w: 7.28, d: 5.46, floors: 2 };
const LV = { GL: 0, F1: 0.7, F2: 3.4, EAVE: 5.95, TOP: 6.889 };
const PITCH = 0.15; // 1.5寸
// 部屋: x, y は「上（北東・奥）左（北西・道路）」原点, 単位 m
const F1 = [
  { n: "収納", t: "closet", x: 0, y: 0, w: 1.82, d: 0.91 },
  { n: "玄関", t: "entrance", x: 0, y: 0.91, w: 0.91, d: 1.82 },
  { n: "ホール", t: "hall", x: 0.91, y: 0.91, w: 0.91, d: 0.91 },
  { n: "階段", t: "stairs", x: 1.82, y: 0, w: 1.82, d: 1.82, dir: "up" },
  { n: "収納", t: "closet", x: 3.64, y: 0, w: 0.91, d: 0.91 },
  { n: "トイレ", t: "toilet", x: 3.64, y: 0.91, w: 0.91, d: 0.91 },
  { n: "廊下", t: "hall", x: 0.91, y: 1.82, w: 3.64, d: 0.91 },
  { n: "洋室", t: "bedroom", x: 4.55, y: 0, w: 2.73, d: 2.73, jo: "4.5帖" },
  { n: "洋室", t: "bedroom", x: 0, y: 2.73, w: 2.73, d: 2.73, jo: "4.5帖" },
  { n: "CL", t: "closet", x: 2.73, y: 2.73, w: 0.91, d: 1.365 },
  { n: "CL", t: "closet", x: 2.73, y: 4.095, w: 0.91, d: 1.365 },
  { n: "洋室", t: "bedroom", x: 3.64, y: 2.73, w: 3.64, d: 2.73, jo: "6.0帖" },
];
const F2 = [
  { n: "トイレ", t: "toilet", x: 0, y: 0, w: 0.91, d: 0.91 },
  { n: "パントリー", t: "closet", x: 0.91, y: 0, w: 0.91, d: 0.91 },
  { n: "階段", t: "stairs", x: 1.82, y: 0, w: 1.82, d: 1.82, dir: "down" },
  { n: "洗面・脱衣室", t: "washroom", x: 3.64, y: 0, w: 1.82, d: 1.82 },
  { n: "浴室", t: "bath", x: 5.46, y: 0, w: 1.82, d: 1.82 },
  { n: "LDK", t: "ldk", x: 0, y: 0.91, w: 1.82, d: 0.91, g: 1 },
  { n: "LDK", t: "ldk", x: 0, y: 1.82, w: 7.28, d: 3.64, g: 1, jo: "17.0帖" },
];
const area = (rooms, t) => rooms.filter((r) => !t || r.t === t).reduce((s, r) => s + r.w * r.d, 0);

/* ---------------- ページ2: 立面図 ---------------- */
function elevationPage() {
  const S = 62; // px / m
  // 面の定義: 幅, 左端の方位, 右端の方位, 屋根 (h at left, h at right)
  const eaveNE = LV.EAVE + B.d * PITCH; // 北東側の軒高
  const faces = [
    { key: "NW", title: "北西立面図（道路側）", width: B.d, left: "北東", right: "南西", hl: eaveNE, hr: LV.EAVE },
    { key: "SW", title: "南西立面図", width: B.w, left: "北西", right: "南東", hl: LV.EAVE, hr: LV.EAVE, back: eaveNE },
    { key: "SE", title: "南東立面図", width: B.d, left: "南西", right: "北東", hl: LV.EAVE, hr: eaveNE },
    { key: "NE", title: "北東立面図（奥側）", width: B.w, left: "南東", right: "北西", hl: eaveNE, hr: eaveNE },
  ];
  // 窓: [面, 左からの位置, 幅, 下端高さ(GL基準), 高さ, 種類]
  const koshi1 = LV.F1 + 0.9, koshi2 = LV.F2 + 0.9;
  const W = [
    ["NW", 3.2, 1.65, koshi1, 1.1, "w"], ["NW", 0.25, 0.6, LV.F2 + 1.5, 0.5, "s"], ["NW", 3.1, 1.65, koshi2, 1.1, "w"],
    ["SW", 0.55, 1.65, koshi1, 1.1, "w"], ["SW", 4.6, 1.69, LV.F1, 2.0, "t"], ["SW", 0.9, 1.69, LV.F2, 2.0, "t"], ["SW", 4.3, 2.55, LV.F2, 2.0, "t"],
    ["SE", 0.55, 1.65, koshi1, 1.1, "w"], ["SE", 3.3, 1.65, koshi1, 1.1, "w"], ["SE", 0.8, 1.65, koshi2, 1.1, "w"], ["SE", 4.35, 0.6, LV.F2 + 1.5, 0.5, "s"],
    ["NE", 0.55, 1.65, koshi1, 1.1, "w"], ["NE", 2.95, 0.5, LV.F1 + 1.5, 0.5, "s"], ["NE", 4.3, 0.4, 2.3, 1.6, "slit"], ["NE", 0.6, 0.6, LV.F2 + 1.5, 0.5, "s"], ["NE", 2.45, 0.6, LV.F2 + 1.4, 0.5, "s"], ["NE", 6.55, 0.5, LV.F2 + 1.5, 0.5, "s"],
  ];
  const door = { face: "NW", at: 1.1, w: 0.95, h: 2.2, canopy: [0.91, 1.82] };
  const cell = (i) => ({ x0: i % 2 === 0 ? 100 : 800, y0: i < 2 ? 90 : 560 });
  let g = "";
  faces.forEach((f, i) => {
    const { x0, y0 } = cell(i);
    const base = y0 + 440; // GL の画面 y
    const X = (m) => x0 + 60 + m * S, Y = (h) => base - h * S;
    const w = f.width;
    // レベル線
    const levels = [["GL ±0", 0], ["1FL +700", LV.F1], ["2FL +3,400", LV.F2], ["軒高 +5,950", LV.EAVE], ["最高高さ +6,889", LV.TOP]];
    g += `<text x="${x0 + 60 + (w * S) / 2}" y="${y0 - 6}" font-size="18" font-weight="700" fill="${INK}" text-anchor="middle">${f.title}</text>`;
    levels.forEach(([lab, h]) => { g += `<line x1="${X(-0.6)}" y1="${Y(h)}" x2="${X(w + 0.6)}" y2="${Y(h)}" stroke="#aaa" stroke-width="0.7" stroke-dasharray="4 3"/><text x="${X(w + 0.7)}" y="${Y(h) + 4}" font-size="11" fill="#333">▽${lab}</text>`; });
    // 地盤
    g += `<line x1="${X(-0.9)}" y1="${Y(0)}" x2="${X(w + 0.9)}" y2="${Y(0)}" stroke="${INK}" stroke-width="2"/>`;
    g += Array.from({ length: Math.round((w + 1.8) / 0.25) }, (_, k) => { const x = X(-0.9) + k * 0.25 * S; return `<line x1="${x}" y1="${Y(0)}" x2="${x - 6}" y2="${Y(0) + 8}" stroke="${INK}" stroke-width="1"/>`; }).join("");
    // 基礎
    g += `<rect x="${X(0)}" y="${Y(0.6)}" width="${w * S}" height="${0.6 * S}" fill="${FOUND}"/>`;
    // 外壁（縦張りガルバ）
    const wallTop = (m) => f.hl + ((f.hr - f.hl) * m) / w; // その位置の軒高
    const wallPath = `M${X(0)},${Y(0.6)} L${X(0)},${Y(f.hl)} L${X(w)},${Y(f.hr)} L${X(w)},${Y(0.6)} Z`;
    g += `<path d="${wallPath}" fill="${DARK}"/>`;
    g += `<clipPath id="wc${i}"><path d="${wallPath}"/></clipPath>`;
    g += `<g clip-path="url(#wc${i})">` + Array.from({ length: Math.round(w / 0.16) }, (_, k) => `<line x1="${X(k * 0.16)}" y1="${Y(0)}" x2="${X(k * 0.16)}" y2="${Y(8)}" stroke="#2f3843" stroke-width="0.8"/>`).join("") + `</g>`;
    // 屋根（軒の厚み・笠木）。高い側から見える屋根面
    if (f.key === "SW") g += `<rect x="${X(-0.05)}" y="${Y(f.back + 0.12)}" width="${(w + 0.1) * S}" height="${(f.back - f.hl) * S}" fill="#3a424d"/><text x="${X(w / 2)}" y="${Y(f.hl + (f.back - f.hl) / 2) + 4}" font-size="10" fill="#cfd6df" text-anchor="middle">屋根面（奥＝北東へ上る片流れ）</text>`;
    g += `<path d="M${X(-0.05)},${Y(f.hl)} L${X(w + 0.05)},${Y(f.hr)} L${X(w + 0.05)},${Y(f.hr + 0.12)} L${X(-0.05)},${Y(f.hl + 0.12)} Z" fill="#0d1014"/>`;
    // 窓
    W.filter((x) => x[0] === f.key).forEach(([, at, ww, bot, hh, kind]) => {
      const x = X(at), y = Y(bot + hh), wpx = ww * S, hpx = hh * S;
      g += `<rect x="${x}" y="${y}" width="${wpx}" height="${hpx}" fill="${GLASS}" stroke="#0d1014" stroke-width="2"/>`;
      if (kind === "w" || kind === "t") g += `<line x1="${x + wpx / 2}" y1="${y}" x2="${x + wpx / 2}" y2="${y + hpx}" stroke="#0d1014" stroke-width="1.5"/><rect x="${x + 3}" y="${y + 3}" width="${wpx / 2 - 6}" height="${hpx - 6}" fill="${GLASS2}" opacity="0.5"/>`;
      if (kind === "t") g += `<rect x="${x}" y="${y + hpx * 0.55}" width="${wpx}" height="${hpx * 0.45}" fill="#8fb3cf" opacity="0.35"/>`;
    });
    // 玄関（木目パネル＋ドア＋庇）
    if (door.face === f.key) {
      const [c0, c1] = door.canopy;
      g += `<rect x="${X(c0)}" y="${Y(LV.F1 + 2.3)}" width="${(c1 - c0) * S}" height="${(2.3) * S}" fill="${FRAME}"/>`;
      g += Array.from({ length: 12 }, (_, k) => `<line x1="${X(c0)}" y1="${Y(LV.F1 + 2.3) + k * 12}" x2="${X(c1)}" y2="${Y(LV.F1 + 2.3) + k * 12}" stroke="#7a4d22" stroke-width="0.6"/>`).join("");
      g += `<rect x="${X(c0 - 0.15)}" y="${Y(LV.F1 + 2.45)}" width="${(c1 - c0 + 0.3) * S}" height="${0.14 * S}" fill="#a9733c"/>`;
      g += `<rect x="${X(door.at)}" y="${Y(LV.F1 - 0.15 + door.h)}" width="${door.w * S}" height="${(door.h) * S}" fill="#6e4a26" stroke="#0d1014" stroke-width="1.5"/>`;
      g += `<rect x="${X(door.at + 0.62)}" y="${Y(LV.F1 - 0.15 + door.h)}" width="${0.28 * S}" height="${door.h * S}" fill="${GLASS}" stroke="#0d1014" stroke-width="1.2"/>`;
      g += `<circle cx="${X(door.at + 0.12)}" cy="${Y(LV.F1 + 0.9)}" r="2.5" fill="#ddd"/>`;
      g += `<rect x="${X(c0)}" y="${Y(0.6)}" width="${(c1 - c0) * S}" height="${0.6 * S}" fill="#8b949e"/>`; // ポーチ
    }
    // 左右の方位
    g += `<text x="${X(-1.05)}" y="${Y(3)}" font-size="14" fill="#333" text-anchor="end">${f.left}</text><text x="${X(w + 0.7)}" y="${Y(2.4)}" font-size="14" fill="#333">${f.right}</text>`;
  });
  const legend = [[DARK, "外壁：ガルバリウム鋼板 縦張り（黒・つや消し）一種類のみ"], [FRAME, "玄関まわり：木目調パネル・庇（不燃材の木目調）"], [GLASS, "サッシ：黒枠（道路側は防火設備）"], [FOUND, "基礎：濃いグレー仕上げ　笠木・見切り：黒（板金）"]];
  const lg = legend.map(([c, t], i) => `<rect x="${120 + (i % 2) * 640}" y="${1010 + Math.floor(i / 2) * 28}" width="24" height="18" fill="${c}" stroke="#333"/><text x="${152 + (i % 2) * 640}" y="${1024 + Math.floor(i / 2) * 28}" font-size="13" fill="#222">${t}</text>`).join("");
  return `<svg viewBox="0 0 1500 1100" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
    <rect width="1500" height="1100" fill="#fff"/>
    <text x="750" y="40" font-size="20" font-weight="700" fill="${INK}" text-anchor="middle">藤沢市鵠沼松が岡4丁目　木造2階建て　立面図　案A　黒ガルバリウム × 木目　　基礎600・天井高2,300/2,300・片流れ1.5寸（北東が高い）　※概略図</text>
    ${g}${lg}
    <text x="1400" y="1088" font-size="12" fill="#666" text-anchor="end">※窓の位置・大きさは提案用の仮配置です。寸法・仕様は設計で確定します。</text>
  </svg>`;
}

/* ---------------- ページ3: 間取り図 ---------------- */
function planPage() {
  const S = 68; // px / m
  const fills = { bedroom: WOOD, ldk: WOOD, hall: "#eadcc4", entrance: "#d9d4cc", closet: "#f2ebdf", toilet: TILE, washroom: TILE, bath: TILE2, stairs: "#f7f2ea" };
  const drawFloor = (rooms, ox, oy, label, areaText, windows) => {
    const X = (m) => ox + m * S, Y = (m) => oy + m * S;
    let g = `<text x="${ox}" y="${oy - 14}" font-size="20" font-weight="700" fill="${INK}">${label}</text><text x="${X(B.w)}" y="${oy - 14}" font-size="14" fill="#444" text-anchor="end">${areaText}</text>`;
    // 床
    rooms.forEach((r) => {
      g += `<rect x="${X(r.x)}" y="${Y(r.y)}" width="${r.w * S}" height="${r.d * S}" fill="${fills[r.t] ?? WOOD}"/>`;
      if (["bedroom", "ldk", "hall"].includes(r.t)) for (let k = 1; k * 0.3 < r.d; k++) g += `<line x1="${X(r.x)}" y1="${Y(r.y + k * 0.3)}" x2="${X(r.x + r.w)}" y2="${Y(r.y + k * 0.3)}" stroke="rgba(120,80,30,0.18)" stroke-width="1"/>`;
      if (["toilet", "washroom", "bath", "entrance"].includes(r.t)) { for (let k = 1; k * 0.3 < r.w; k++) g += `<line x1="${X(r.x + k * 0.3)}" y1="${Y(r.y)}" x2="${X(r.x + k * 0.3)}" y2="${Y(r.y + r.d)}" stroke="rgba(60,90,120,0.18)" stroke-width="1"/>`; for (let k = 1; k * 0.3 < r.d; k++) g += `<line x1="${X(r.x)}" y1="${Y(r.y + k * 0.3)}" x2="${X(r.x + r.w)}" y2="${Y(r.y + k * 0.3)}" stroke="rgba(60,90,120,0.18)" stroke-width="1"/>`; }
    });
    // 内壁（同じグループ同士は壁なし）
    const eps = 1e-6;
    rooms.forEach((r) => {
      const edges = [[r.x, r.y, r.x + r.w, r.y], [r.x, r.y + r.d, r.x + r.w, r.y + r.d], [r.x, r.y, r.x, r.y + r.d], [r.x + r.w, r.y, r.x + r.w, r.y + r.d]];
      edges.forEach(([x1, y1, x2, y2]) => {
        // 外周は太い壁で別描画
        const outer = (x1 === x2 && (Math.abs(x1) < eps || Math.abs(x1 - B.w) < eps)) || (y1 === y2 && (Math.abs(y1) < eps || Math.abs(y1 - B.d) < eps));
        if (outer) return;
        // 同じ group の隣と接する辺は描かない
        const shared = rooms.some((o) => o !== r && o.g && o.g === r.g && ((x1 === x2 && (Math.abs(o.x - x1) < eps || Math.abs(o.x + o.w - x1) < eps) && Math.min(o.y + o.d, y2) - Math.max(o.y, y1) > eps) || (y1 === y2 && (Math.abs(o.y - y1) < eps || Math.abs(o.y + o.d - y1) < eps) && Math.min(o.x + o.w, x2) - Math.max(o.x, x1) > eps)));
        if (shared) return;
        g += `<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${WALL}" stroke-width="6" stroke-linecap="square"/>`;
      });
    });
    // 外壁
    g += `<rect x="${X(0)}" y="${Y(0)}" width="${B.w * S}" height="${B.d * S}" fill="none" stroke="${WALL}" stroke-width="12"/>`;
    // 窓（外壁上）: [辺 n/s/e/w, 位置, 幅]
    windows.forEach(([side, at, ww]) => {
      const t = 12;
      if (side === "n") g += `<rect x="${X(at)}" y="${Y(0) - t / 2}" width="${ww * S}" height="${t}" fill="${GLASS}" stroke="${WALL}" stroke-width="1.5"/><line x1="${X(at)}" y1="${Y(0)}" x2="${X(at + ww)}" y2="${Y(0)}" stroke="#fff" stroke-width="1.5"/>`;
      if (side === "s") g += `<rect x="${X(at)}" y="${Y(B.d) - t / 2}" width="${ww * S}" height="${t}" fill="${GLASS}" stroke="${WALL}" stroke-width="1.5"/><line x1="${X(at)}" y1="${Y(B.d)}" x2="${X(at + ww)}" y2="${Y(B.d)}" stroke="#fff" stroke-width="1.5"/>`;
      if (side === "w") g += `<rect x="${X(0) - t / 2}" y="${Y(at)}" width="${t}" height="${ww * S}" fill="${GLASS}" stroke="${WALL}" stroke-width="1.5"/><line x1="${X(0)}" y1="${Y(at)}" x2="${X(0)}" y2="${Y(at + ww)}" stroke="#fff" stroke-width="1.5"/>`;
      if (side === "e") g += `<rect x="${X(B.w) - t / 2}" y="${Y(at)}" width="${t}" height="${ww * S}" fill="${GLASS}" stroke="${WALL}" stroke-width="1.5"/><line x1="${X(B.w)}" y1="${Y(at)}" x2="${X(B.w)}" y2="${Y(at + ww)}" stroke="#fff" stroke-width="1.5"/>`;
    });
    // 家具・記号
    rooms.forEach((r) => {
      const cx = X(r.x + r.w / 2), cy = Y(r.y + r.d / 2);
      if (r.t === "bedroom") {
        const bw = Math.min(r.w - 0.4, 1.5) * S, bd = Math.min(r.d - 0.3, 2.0) * S;
        const bx = X(r.x + r.w) - bw - 0.15 * S, by = Y(r.y) + 0.15 * S;
        g += `<rect x="${bx}" y="${by}" width="${bw}" height="${bd}" rx="6" fill="#fff" stroke="#8a6a45" stroke-width="2"/><rect x="${bx + 8}" y="${by + 8}" width="${bw / 2 - 12}" height="${bd * 0.18}" rx="5" fill="#eef1f5" stroke="#9aa"/><rect x="${bx + bw / 2 + 4}" y="${by + 8}" width="${bw / 2 - 12}" height="${bd * 0.18}" rx="5" fill="#eef1f5" stroke="#9aa"/><rect x="${bx + 6}" y="${by + bd * 0.3}" width="${bw - 12}" height="${bd * 0.66}" rx="6" fill="#aac4de"/>`;
        // 机
        g += `<rect x="${X(r.x) + 0.12 * S}" y="${Y(r.y + r.d) - 0.6 * S}" width="${1.0 * S}" height="${0.45 * S}" fill="#c99a6b" stroke="#8a6a45" stroke-width="1.5"/>`;
        g += `<circle cx="${X(r.x) + 0.15 * S + 6}" cy="${Y(r.y) + 0.2 * S}" r="8" fill="#8cc08c"/><circle cx="${X(r.x) + 0.15 * S + 12}" cy="${Y(r.y) + 0.2 * S - 5}" r="6" fill="#6fae6f"/>`;
      }
      if (r.t === "ldk" && r.jo) {
        // キッチン（上側、右寄り）
        const kx = X(r.x + r.w) - 2.75 * S, ky = Y(r.y) + 0.1 * S;
        g += `<rect x="${kx}" y="${ky}" width="${2.55 * S}" height="${0.65 * S}" fill="#fff" stroke="#666" stroke-width="1.5"/>`;
        g += `<rect x="${kx + 12}" y="${ky + 10}" width="${0.7 * S}" height="${0.4 * S}" rx="6" fill="#dfe6ec" stroke="#889"/><circle cx="${kx + 12 + 0.35 * S}" cy="${ky + 10 + 0.2 * S}" r="3" fill="#889"/>`;
        [0, 1, 2].forEach((k) => (g += `<circle cx="${kx + 1.55 * S + k * 20}" cy="${ky + 0.33 * S}" r="7" fill="none" stroke="#333" stroke-width="2"/>`));
        // ダイニングテーブル＋椅子
        const tx = X(r.x) + 2.0 * S, ty = Y(r.y) + 1.0 * S;
        g += `<rect x="${tx}" y="${ty}" width="${1.5 * S}" height="${0.85 * S}" rx="6" fill="#8a5a3a"/>`;
        [0.25, 1.0].forEach((o) => { g += `<circle cx="${tx + o * S + 10}" cy="${ty - 14}" r="12" fill="#3f2a1c"/><circle cx="${tx + o * S + 10}" cy="${ty + 0.85 * S + 14}" r="12" fill="#3f2a1c"/>`; });
        // ソファ（L字）＋ラグ＋テレビ
        const sx = X(r.x + r.w) - 2.5 * S, sy = Y(r.y + r.d) - 1.9 * S;
        g += `<rect x="${sx - 0.35 * S}" y="${sy - 0.35 * S}" width="${2.6 * S}" height="${2.05 * S}" fill="#f3e3c3" stroke="#e0c99e" stroke-dasharray="4 4"/>`;
        g += `<rect x="${sx}" y="${sy}" width="${0.85 * S}" height="${1.6 * S}" rx="8" fill="#f2c14e" stroke="#c99a2e" stroke-width="2"/><rect x="${sx}" y="${sy + 1.2 * S}" width="${1.7 * S}" height="${0.5 * S}" rx="8" fill="#f2c14e" stroke="#c99a2e" stroke-width="2"/>`;
        g += `<rect x="${sx + 1.2 * S}" y="${sy}" width="${0.35 * S}" height="${0.35 * S}" fill="#444"/>`;
        g += `<rect x="${X(r.x + r.w) - 0.22 * S}" y="${sy + 0.1 * S}" width="${0.12 * S}" height="${1.3 * S}" fill="#222"/>`;
        g += `<circle cx="${X(r.x) + 0.25 * S}" cy="${Y(r.y + r.d) - 0.3 * S}" r="9" fill="#8cc08c"/><circle cx="${X(r.x) + 0.25 * S + 7}" cy="${Y(r.y + r.d) - 0.3 * S - 6}" r="7" fill="#6fae6f"/>`;
      }
      if (r.t === "toilet") g += `<ellipse cx="${cx}" cy="${cy - 4}" rx="${0.19 * S}" ry="${0.24 * S}" fill="#fff" stroke="#556" stroke-width="1.5"/><rect x="${cx - 0.17 * S}" y="${cy - 0.42 * S}" width="${0.34 * S}" height="${0.16 * S}" rx="3" fill="#fff" stroke="#556" stroke-width="1.5"/>`;
      if (r.t === "washroom") { g += `<rect x="${X(r.x + r.w) - 0.6 * S}" y="${Y(r.y) + 0.1 * S}" width="${0.5 * S}" height="${1.65 * S}" fill="#fff" stroke="#556" stroke-width="1.5"/><ellipse cx="${X(r.x + r.w) - 0.35 * S}" cy="${Y(r.y) + 0.55 * S}" rx="11" ry="9" fill="#e8eef3" stroke="#556"/><ellipse cx="${X(r.x + r.w) - 0.35 * S}" cy="${Y(r.y) + 1.3 * S}" rx="11" ry="9" fill="#e8eef3" stroke="#556"/><rect x="${X(r.x) + 0.12 * S}" y="${Y(r.y) + 0.12 * S}" width="${0.62 * S}" height="${0.62 * S}" rx="6" fill="#fff" stroke="#556"/><circle cx="${X(r.x) + 0.43 * S}" cy="${Y(r.y) + 0.43 * S}" r="${0.2 * S}" fill="none" stroke="#889"/><text x="${X(r.x) + 0.43 * S}" y="${Y(r.y) + 0.9 * S}" font-size="8" fill="#555" text-anchor="middle">ドラム式</text>`; }
      if (r.t === "bath") g += `<rect x="${X(r.x) + 0.12 * S}" y="${Y(r.y + r.d) - 0.85 * S}" width="${1.58 * S}" height="${0.7 * S}" rx="14" fill="#fff" stroke="#556" stroke-width="1.5"/><circle cx="${X(r.x) + 1.5 * S}" cy="${Y(r.y + r.d) - 0.5 * S}" r="3" fill="#556"/><circle cx="${X(r.x + r.w / 2)}" cy="${Y(r.y) + 0.45 * S}" r="6" fill="none" stroke="#889"/><line x1="${X(r.x + r.w / 2) - 4}" y1="${Y(r.y) + 0.45 * S}" x2="${X(r.x + r.w / 2) + 4}" y2="${Y(r.y) + 0.45 * S}" stroke="#889"/>`;
      if (r.t === "closet") for (let k = 1; k * 0.25 < r.w; k++) g += `<line x1="${X(r.x + k * 0.25)}" y1="${Y(r.y) + 4}" x2="${X(r.x + k * 0.25)}" y2="${Y(r.y + r.d) - 4}" stroke="#c9bda8" stroke-width="1"/>`;
      if (r.t === "stairs") {
        const n = 12, tw = r.w * S, td = r.d * S, x0 = X(r.x), y0 = Y(r.y);
        // 回り階段: 左側に直線部、右上で回る簡略表現
        for (let k = 0; k <= 6; k++) g += `<line x1="${x0}" y1="${y0 + td - (k * td) / 6.5}" x2="${x0 + tw / 2}" y2="${y0 + td - (k * td) / 6.5}" stroke="#444" stroke-width="1"/>`;
        for (let k = 0; k <= 5; k++) { const a = (Math.PI / 2) * (k / 5); g += `<line x1="${x0 + tw / 2}" y1="${y0 + td / 2}" x2="${x0 + tw / 2 + Math.cos(a) * tw / 2}" y2="${y0 + td / 2 - Math.sin(a) * td / 2}" stroke="#444" stroke-width="1"/>`; }
        for (let k = 1; k <= 3; k++) g += `<line x1="${x0 + tw / 2 + (k * tw) / 7}" y1="${y0 + td / 2}" x2="${x0 + tw / 2 + (k * tw) / 7}" y2="${y0 + td}" stroke="#444" stroke-width="1"/>`;
        g += `<path d="M${x0 + tw * 0.25},${y0 + td - 10} L${x0 + tw * 0.25},${y0 + td * 0.5} L${x0 + tw * 0.62},${y0 + td * 0.5} L${x0 + tw * 0.62},${y0 + td - 12}" fill="none" stroke="#c0392b" stroke-width="1.5" marker-end="url(#red)"/>`;
        g += `<text x="${x0 + tw * 0.72}" y="${y0 + td - 4}" font-size="9" fill="#c0392b">${r.dir === "up" ? "UP" : "DN"}</text>`;
        void n;
      }
    });
    // ラベル
    rooms.forEach((r) => {
      if (r.t === "ldk" && !r.jo) return;
      const cx = X(r.x + r.w / 2), cy = Y(r.y + r.d / 2);
      const small = r.w * r.d < 1.2;
      const fs = small ? 10 : r.t === "ldk" ? 20 : 14;
      let lx = r.t === "ldk" ? X(r.x) + 3.6 * S : r.t === "bedroom" ? X(r.x) + 0.7 * S : cx;
      let ly = r.t === "ldk" ? Y(r.y) + 1.5 * S : r.t === "bedroom" ? cy + 4 : cy + (r.jo ? -2 : 4);
      if (r.t === "toilet") ly = Y(r.y + r.d) - 6;
      if (r.t === "washroom") { lx = X(r.x) + 0.62 * S; ly = Y(r.y + r.d) - 8; }
      if (r.t === "bath") ly = Y(r.y) + 0.3 * S + 4;
      if (r.t === "stairs") { lx = X(r.x) + 0.45 * S; ly = Y(r.y) + 0.3 * S + 4; }
      g += `<text x="${lx}" y="${ly}" font-size="${fs}" font-weight="700" fill="#222" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">${r.n}</text>`;
      if (r.jo) g += `<text x="${lx}" y="${ly + 16}" font-size="12" fill="#333" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">${r.jo}</text>`;
    });
    return g;
  };
  // 建具（ドアの弧）を簡略追加: [x, y, 幅, 向き(上開き "n" 等), 階]
  const doorArc = (X, Y, x, y, w, dir) => {
    const s = w * S;
    if (dir === "e") return `<path d="M${X(x)},${Y(y)} A${s},${s} 0 0 1 ${X(x + w)},${Y(y + w)}" fill="none" stroke="#333" stroke-width="1"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x + w)}" y2="${Y(y)}" stroke="#fff" stroke-width="7"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(y + w)}" stroke="#333" stroke-width="2"/>`;
    if (dir === "s") return `<path d="M${X(x)},${Y(y)} A${s},${s} 0 0 1 ${X(x + w)},${Y(y + w)}" fill="none" stroke="#333" stroke-width="1"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(y + w)}" stroke="#fff" stroke-width="7"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x + w)}" y2="${Y(y)}" stroke="#333" stroke-width="2"/>`;
    if (dir === "n") return `<path d="M${X(x)},${Y(y)} A${s},${s} 0 0 0 ${X(x + w)},${Y(y - w)}" fill="none" stroke="#333" stroke-width="1"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(y - w)}" stroke="#fff" stroke-width="7"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x + w)}" y2="${Y(y)}" stroke="#333" stroke-width="2"/>`;
    if (dir === "w") return `<path d="M${X(x)},${Y(y)} A${s},${s} 0 0 0 ${X(x - w)},${Y(y + w)}" fill="none" stroke="#333" stroke-width="1"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x - w)}" y2="${Y(y)}" stroke="#fff" stroke-width="7"/><line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(y + w)}" stroke="#333" stroke-width="2"/>`;
    return "";
  };
  const ox1 = 90, oy1 = 150, ox2 = 760, oy2 = 150;
  const X1 = (m) => ox1 + m * S, Y1 = (m) => oy1 + m * S, X2 = (m) => ox2 + m * S, Y2 = (m) => oy2 + m * S;
  // 窓: 1F: 北西(w)=左辺, 南西(s)=下辺, 南東(e)=右辺, 北東(n)=上辺
  const win1 = [["w", 3.3, 1.65], ["s", 0.55, 1.65], ["s", 4.6, 1.69], ["e", 0.55, 1.65], ["e", 3.3, 1.65], ["n", 4.9, 1.65], ["n", 3.85, 0.5], ["n", 2.5, 0.4]];
  const win2 = [["w", 0.15, 0.6], ["w", 3.2, 1.65], ["s", 0.9, 1.69], ["s", 4.3, 2.55], ["e", 0.5, 0.6], ["e", 3.4, 1.65], ["n", 6.1, 0.6], ["n", 4.2, 0.6], ["n", 0.2, 0.5]];
  let g = drawFloor(F1, ox1, oy1, "1階", `床面積 ${area(F1).toFixed(2)}㎡`, win1) + drawFloor(F2, ox2, oy2, "2階", `床面積 ${area(F2).toFixed(2)}㎡`, win2);
  // ドア（外開きの玄関ドア、各室ドア）
  g += `<line x1="${X1(0)}" y1="${Y1(1.2)}" x2="${X1(0)}" y2="${Y1(2.1)}" stroke="#fff" stroke-width="12"/><path d="M${X1(0)},${Y1(1.2)} A${0.9 * S},${0.9 * S} 0 0 0 ${X1(-0.9)},${Y1(2.1)}" fill="none" stroke="#333" stroke-width="1"/><line x1="${X1(0)}" y1="${Y1(2.1)}" x2="${X1(-0.9)}" y2="${Y1(2.1)}" stroke="#333" stroke-width="2"/>`;
  g += doorArc(X1, Y1, 4.55, 0.95, 0.75, "e"); // 洋室A（廊下から）
  g += doorArc(X1, Y1, 1.0, 2.73, 0.75, "n"); // 洋室B（廊下側へ開く）
  g += doorArc(X1, Y1, 4.0, 2.73, 0.75, "n"); // 洋室C（廊下側へ開く）
  g += doorArc(X1, Y1, 3.64, 1.0, 0.65, "e"); // トイレ
  g += `<line x1="${X1(2.73)}" y1="${Y1(3.2)}" x2="${X1(2.73)}" y2="${Y1(3.8)}" stroke="#fff" stroke-width="7"/><line x1="${X1(2.73)}" y1="${Y1(4.4)}" x2="${X1(2.73)}" y2="${Y1(5.0)}" stroke="#fff" stroke-width="7"/><line x1="${X1(3.64)}" y1="${Y1(4.4)}" x2="${X1(3.64)}" y2="${Y1(5.0)}" stroke="#fff" stroke-width="7"/>`; // CL 折れ戸（開口）
  g += `<line x1="${X1(0.91)}" y1="${Y1(0.15)}" x2="${X1(0.91)}" y2="${Y1(0.75)}" stroke="#fff" stroke-width="7"/><line x1="${X1(0.91)}" y1="${Y1(1.0)}" x2="${X1(0.91)}" y2="${Y1(1.7)}" stroke="#fff" stroke-width="7"/>`; // 収納・ホール
  g += doorArc(X2, Y2, 0.91, 0.1, 0.65, "e"); // 2F トイレ
  g += `<line x1="${X2(1.0)}" y1="${Y2(0.91)}" x2="${X2(1.7)}" y2="${Y2(0.91)}" stroke="#fff" stroke-width="7"/>`; // パントリー
  g += doorArc(X2, Y2, 3.64, 0.95, 0.75, "e"); // 洗面
  g += `<line x1="${X2(5.46)}" y1="${Y2(1.0)}" x2="${X2(5.46)}" y2="${Y2(1.7)}" stroke="#fff" stroke-width="7"/><line x1="${X2(5.46)}" y1="${Y2(1.0)}" x2="${X2(5.46)}" y2="${Y2(1.7)}" stroke="#889" stroke-width="2" stroke-dasharray="3 2"/>`; // 浴室折れ戸
  g += `<line x1="${X2(1.82)}" y1="${Y2(1.82)}" x2="${X2(3.4)}" y2="${Y2(1.82)}" stroke="#fff" stroke-width="7"/>`; // 階段口
  g += `<line x1="${X1(1.82)}" y1="${Y1(1.82)}" x2="${X1(2.6)}" y2="${Y1(1.82)}" stroke="#fff" stroke-width="7"/>`; // 1F 階段口
  const north = (x, y) => `<g transform="translate(${x},${y}) rotate(40)"><line x1="0" y1="26" x2="0" y2="-26" stroke="${INK}" stroke-width="2"/><path d="M0,-30 L6,-12 L-6,-12 Z" fill="${INK}"/><text y="-36" font-size="14" font-weight="700" text-anchor="middle" fill="${INK}">N</text></g>`;
  const total = area(F1) + area(F2);
  return `<svg viewBox="0 0 1400 700" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
    <defs><marker id="red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="#c0392b"/></marker></defs>
    <rect width="1400" height="700" fill="#fff"/>
    <text x="700" y="44" font-size="24" font-weight="700" fill="${INK}" text-anchor="middle">藤沢市鵠沼松が岡4丁目　木造2階建て　間取りプラン</text>
    <text x="700" y="70" font-size="13" fill="#333" text-anchor="middle">敷地 99.17㎡（30.00坪）　建築面積 ${area(F1).toFixed(2)}㎡　1階 ${area(F1).toFixed(2)}㎡ ／ 2階 ${area(F2).toFixed(2)}㎡　延床 ${total.toFixed(2)}㎡（${(total / 3.30579).toFixed(2)}坪）　3LDK　建蔽率 ${((area(F1) / 99.17) * 100).toFixed(1)}%・容積率 ${((total / 99.17) * 100).toFixed(1)}%</text>
    ${g}
    ${north(ox1 + B.w * S + 40, oy1 + 30)}${north(ox2 + B.w * S + 40, oy2 + 30)}
    <text x="${ox1}" y="${oy1 + B.d * S + 40}" font-size="11" fill="#555">左（北西）が道路側。玄関は道路に面し、洋室3室は南西・南東に面します。</text>
    <text x="${ox2}" y="${oy2 + B.d * S + 40}" font-size="11" fill="#555">2階は南西・南東に大きな窓のLDK 17帖。水回りは北東側にまとめ、洗面台1650・浴室1616。</text>
    <text x="1310" y="680" font-size="11" fill="#666" text-anchor="end">※参考プラン。面積は壁芯の概算。家具は配置イメージです。建築には別途設計・建築確認が必要です。</text>
  </svg>`;
}

const pages = [sitePage(), elevationPage(), planPage()];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: ${FONT}; }
  .page { width: 297mm; height: 210mm; page-break-after: always; display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden; }
  .page svg { width: 297mm; height: 210mm; }
</style></head><body>${pages.map((p) => `<div class="page">${p}</div>`).join("")}</body></html>`;
fs.writeFileSync(`${out}/plan-a.html`, html);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1400, height: 990 } });
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: `${out}/鵠沼松が岡4丁目_2階建て_案A.pdf`, format: "A4", landscape: true, printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
for (let i = 0; i < pages.length; i++) {
  const p2 = await browser.newPage({ viewport: { width: i === 1 ? 1500 : 1400, height: i === 1 ? 1100 : i === 2 ? 700 : 990 }, deviceScaleFactor: 2 });
  await p2.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style></head><body>${pages[i]}</body></html>`);
  await p2.screenshot({ path: `${out}/page${i + 1}.png`, fullPage: true });
  await p2.close();
}
await browser.close();
console.log("done", out);
