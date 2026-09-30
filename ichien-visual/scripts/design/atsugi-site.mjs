// 厚木市旭町4丁目 2004-3 配置図（道路後退を表示）: node scripts/design/atsugi-site.mjs <outdir>
import { chromium } from "playwright";
import fs from "node:fs";
const out = process.argv[2] ?? "/tmp/design";
fs.mkdirSync(out, { recursive: true });
const FONT = "'IPAPGothic','IPAGothic','Noto Sans JP',sans-serif";
const INK = "#1c2430";
// 境界点図の座標（任意座標系、X=南北, Y=東西）→ x=Y, y=X で平行移動（m）
const P = { P1: [8.321, 0], P2: [0.33, 0.129], P3: [0, 0.149], P4: [0.156, 9.607], P5: [10.963, 9.448] };
// 後退後の有効宅地（西側 1.1m 後退）: P2,P3 は後退線上の同じ点に、P4 は後退線と北辺の交点に
const E = { E1: [8.321, 0], E2: [1.0996, 0.1166], E4: [1.2559, 9.5908], E5: [10.963, 9.448] };
const area = (pts) => Math.abs(pts.reduce((s, [x, y], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; return s + x * ny - nx * y; }, 0) / 2);
const A_all = area([P.P1, P.P2, P.P3, P.P4, P.P5]);
const A_eff = area([E.E1, E.E2, E.E4, E.E5]);
const A_strip = A_all - A_eff;
const S = 58, ox = 360, oy = 110 + 10.6 * S;
const X = (x) => ox + x * S, Y = (y) => oy - y * S;
const poly = (pts) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");
const dim = (a, b, label, off, side = 1, size = 20) => {
  const ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]);
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  const nx = (-dy / L) * side, ny = (dx / L) * side;
  const x1 = ax + nx * off, y1 = ay + ny * off, x2 = bx + nx * off, y2 = by + ny * off;
  const mx = (x1 + x2) / 2 + nx * 14, my = (y1 + y2) / 2 + ny * 14;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rot = ang > 90 || ang < -90 ? ang + 180 : ang;
  return `<g stroke="${INK}" stroke-width="1.2" fill="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-start="url(#ar)" marker-end="url(#ar)"/>
    <line x1="${ax + nx * 4}" y1="${ay + ny * 4}" x2="${x1 + nx * 5}" y2="${y1 + ny * 5}" stroke-width="0.8"/><line x1="${bx + nx * 4}" y1="${by + ny * 4}" x2="${x2 + nx * 5}" y2="${y2 + ny * 5}" stroke-width="0.8"/></g>
    <text x="${mx}" y="${my}" font-size="${size}" fill="${INK}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${mx} ${my})">${label}</text>`;
};
// 道路帯
const roadW_west = 1.8 * S, roadW_east = 5.0 * S;
const west = `<polygon points="${X(-0.1) - roadW_west},${Y(12)} ${X(0.05)},${Y(12)} ${X(0.2)},${Y(-2.5)} ${X(-0.1) - roadW_west},${Y(-2.5)}" fill="#e6e9ee"/>`;
// 東側の道路帯: P5→P1 の延長線に沿って
const d = [P.P1[0] - P.P5[0], P.P1[1] - P.P5[1]]; const L = Math.hypot(...d); const ux = d[0] / L, uy = d[1] / L; const nx = -uy, ny = ux; // 外向き（東）
const ext = 3.5;
const e0 = [P.P5[0] - ux * ext, P.P5[1] - uy * ext], e1 = [P.P1[0] + ux * ext, P.P1[1] + uy * ext];
const east = `<polygon points="${poly([e0, e1, [e1[0] + nx * 5, e1[1] + ny * 5], [e0[0] + nx * 5, e0[1] + ny * 5]])}" fill="#e6e9ee"/>`;
const hatch = `<defs><pattern id="h" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#b03a2e" stroke-width="1.4"/></pattern>
<marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="${INK}"/></marker></defs>`;
const compass = `<g transform="translate(1310,110)"><circle r="40" fill="none" stroke="${INK}" stroke-width="2"/><path d="M0,-38 L11,11 L0,4 L-11,11 Z" fill="${INK}"/><path d="M0,-38 L-11,11 L0,4 Z" fill="#fff" stroke="${INK}" stroke-width="1.5"/><text y="-50" font-size="24" font-weight="700" text-anchor="middle" fill="${INK}">N</text></g>`;
const cx = X(6.2), cy = Y(5.2);
const svg = `<svg viewBox="0 0 1400 990" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
  ${hatch}<rect width="1400" height="990" fill="#fff"/>
  ${west}${east}
  <text x="${X(-0.1) - roadW_west / 2}" y="${Y(7.2)}" font-size="26" font-weight="700" fill="${INK}" text-anchor="middle">約1.8m</text>
  <text x="${X(-0.1) - roadW_west / 2}" y="${Y(6.6)}" font-size="16" fill="${INK}" text-anchor="middle">市道A-144号</text>
  <text x="${X(-0.1) - roadW_west / 2}" y="${Y(6.2)}" font-size="16" fill="${INK}" text-anchor="middle">法42条2項 公道</text>
  <text x="${X(-0.1) - roadW_west / 2}" y="${Y(5.8)}" font-size="13" fill="#555" text-anchor="middle">中心から2m後退</text>
  <g transform="translate(${X((P.P5[0] + P.P1[0]) / 2 + nx * 3.3)},${Y((P.P5[1] + P.P1[1]) / 2 + ny * 3.3)}) rotate(${-(Math.atan2(uy, ux) * 180 / Math.PI) - 90})">
    <text font-size="26" font-weight="700" fill="${INK}" text-anchor="middle">約16.0m</text>
    <text y="30" font-size="15" fill="${INK}" text-anchor="middle">県道酒井・金田線（都市計画道路3・3・1平塚相模原線）</text>
    <text y="52" font-size="15" fill="${INK}" text-anchor="middle">法42条1項1号 公道・整備済</text>
  </g>
  <polygon points="${poly([P.P1, P.P2, P.P3, P.P4, P.P5])}" fill="#f5e9d3" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <polygon points="${poly([P.P2, P.P3, P.P4, E.E4, E.E2])}" fill="url(#h)" stroke="none"/>
  <polygon points="${poly([E.E1, E.E2, E.E4, E.E5])}" fill="none" stroke="#b03a2e" stroke-width="2" stroke-dasharray="10 5"/>
  ${Object.entries(P).map(([k, [x, y]]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/><text x="${X(x) + (k === "P1" || k === "P5" ? 12 : -12)}" y="${Y(y) + (k === "P4" || k === "P5" ? -10 : 22)}" font-size="14" fill="${INK}" text-anchor="${k === "P1" || k === "P5" ? "start" : "end"}">${k}</text>`).join("")}
  ${dim(P.P4, P.P5, "10.80m", 40, -1)}
  ${dim(P.P5, P.P1, "9.81m", 34, 1)}
  ${dim(P.P1, P.P2, "7.99m", 40, -1)}
  ${dim(P.P3, P.P4, "9.45m", 40, -1)}
  ${dim(E.E4, P.P5, "9.71m", 72, -1, 15)}
  ${dim(P.P1, E.E2, "7.22m", 72, -1, 15)}
  ${dim(P.P4, E.E4, "1.10", 14, 1, 13)}
  ${dim(E.E2, P.P2, "0.77", 14, 1, 13)}
  ${dim(P.P2, P.P3, "0.33", 14, 1, 13)}
  <text x="${X(0.62)}" y="${Y(5.0)}" font-size="12" fill="#b03a2e" text-anchor="middle" transform="rotate(-90 ${X(0.62)} ${Y(5.0)})">道路後退部分 約${A_strip.toFixed(2)}m²（後退 約1.10m）</text>
  <text x="${cx}" y="${cy - 40}" font-size="20" fill="#555" text-anchor="middle">有効宅地（道路後退後）</text>
  <text x="${cx}" y="${cy + 14}" font-size="60" font-weight="700" fill="${INK}" text-anchor="middle">${A_eff.toFixed(2)}m²</text>
  <line x1="${cx - 150}" y1="${cy + 30}" x2="${cx + 150}" y2="${cy + 30}" stroke="${INK}" stroke-width="1.5"/>
  <text x="${cx}" y="${cy + 66}" font-size="30" fill="${INK}" text-anchor="middle">(${(A_eff / 3.30579).toFixed(2)}坪)</text>
  <text x="${cx}" y="${cy + 100}" font-size="15" fill="#444" text-anchor="middle">敷地全体 ${A_all.toFixed(2)}m²（座標計算）− 道路後退部分 ${A_strip.toFixed(2)}m²</text>
  <text x="${cx}" y="${cy + 122}" font-size="14" fill="#666" text-anchor="middle">販売図面: 土地 80.28m²（24.28坪）・後退部分 約10.32m²</text>
  <text x="${X(4.2)}" y="${Y(-0.3)}" font-size="13" fill="#555" text-anchor="middle">南側 隣地 1996-1</text>
  <text x="${X(5.5)}" y="${Y(9.95)}" font-size="13" fill="#555" text-anchor="middle">北側 隣地 2004-5</text>
  ${compass}
  <rect x="40" y="26" width="620" height="46" fill="#fff" opacity="0.9"/>
  <text x="60" y="58" font-size="26" font-weight="700" fill="${INK}">厚木市旭町4丁目 2004-3　配置図（道路後退あり）</text>
  <text x="60" y="930" font-size="13" fill="#666">出典: 境界点図（有限会社誠心測量 令和6年7月6日・任意座標系）の座標一覧表、販売図面（図面コード6930914）。座標は任意座標系のため方位は境界点図の方位記号によります。</text>
  <text x="60" y="952" font-size="13" fill="#666">後退幅は幅員約1.8mの2項道路の中心から2m（(4−1.8)÷2=1.10m）として計算。後退部分は狭あい協議により変わることがあります。地積は測量前につき増減する場合があります。</text>
  <text x="60" y="974" font-size="13" fill="#666">※参考図です。実際の取引前には宅建士・建築士等の専門家による確認を推奨します。</text>
</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:0}body{margin:0}.page{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.page svg{width:297mm;height:210mm}</style></head><body><div class="page">${svg}</div></body></html>`;
fs.writeFileSync(`${out}/atsugi-site.html`, html);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1400, height: 990 } });
await page.setContent(html, { waitUntil: "load" });
await page.pdf({ path: `${out}/厚木市旭町4丁目_配置図.pdf`, format: "A4", landscape: true, printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
const p2 = await browser.newPage({ viewport: { width: 1400, height: 990 }, deviceScaleFactor: 2 });
await p2.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style></head><body>${svg}</body></html>`);
await p2.screenshot({ path: `${out}/厚木市旭町4丁目_配置図.png`, fullPage: true });
await browser.close();
console.log(JSON.stringify({ A_all: A_all.toFixed(3), A_eff: A_eff.toFixed(3), A_strip: A_strip.toFixed(3) }));
