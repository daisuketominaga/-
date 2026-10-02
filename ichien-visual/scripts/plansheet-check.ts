// 図面出力（間取り図シート）の自動検査
//   npx tsx --tsconfig scripts/tsconfig.json scripts/plansheet-check.ts [出力フォルダ]
//   （scripts/tsconfig.json は JSX を自動変換にするための設定。Next のビルドには影響しない）
// 検査内容:
//   1. 家具（自動配置）が部屋・扉の開き・出入口の前・記号・他の家具と重なっていない
//   2. シートの各階タイトルの床面積が floorAreaOf（画面と同じ関数）と一致する
//   3. 部屋の帖数（w×d÷1.6562㎡）がシートに同じ文字で入っている
//   4. 定型注記 3 つが入っている
//   5. SVG を書き出し、Chromium があれば画像（JPEG。ImageMagick が無ければ PNG）にも描く（目視確認用）
// 本藤沢1丁目の JSON が手に入ったら、環境変数 PLAN_JSON=path で読み込んで同じ検査にかける。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { sampleProject, lessonProject1, lessonProject2, lessonProject3, lessonProject4 } from "../src/lib/sample";
import { planSheetSvg, planSheetLayout, PLAN_NOTES } from "../src/lib/planSvg";
import { checkFurniture, FURNITURE } from "../src/lib/furniture";
import { floorAreaOf, round } from "../src/lib/geometry";
import { TATAMI_M2 } from "../src/lib/types";
import type { Project } from "../src/lib/types";
import { roomGroups } from "../src/lib/roomGroups";

const out = process.argv[2] ?? path.join(process.cwd(), ".plansheet-out");
fs.mkdirSync(out, { recursive: true });

const projects: Project[] = [sampleProject(), lessonProject1(), lessonProject2(), lessonProject3(), lessonProject4()];
if (process.env.PLAN_JSON) projects.unshift(JSON.parse(fs.readFileSync(process.env.PLAN_JSON, "utf8")) as Project);

let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "  ok " : "  NG "} ${msg}`);
  if (!cond) failures++;
};

function findChrome(): string | null {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = ["/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r)) {
      for (const c of [path.join(r, d, "chrome-linux", "chrome"), path.join(r, d, "chrome-linux", "headless_shell")]) if (fs.existsSync(c)) return c;
    }
  }
  return null;
}
const chrome = findChrome();

for (const p of projects) {
  console.log(`\n■ ${p.name}（${p.floors.length} 階）`);
  const layout = planSheetLayout(p, { date: "2026-10-02" });
  const svg = planSheetSvg(p, { date: "2026-10-02" });
  // 1. 家具の重なり
  for (const c of layout.cells) {
    const issues = checkFurniture(p.building, c.floor.rooms, c.floor.fixtures ?? [], c.furniture);
    ok(issues.length === 0, `${c.level}階 家具 ${c.furniture.length} 点: 重なりなし${issues.length ? " → " + issues.join("／") : ""}`);
    if (c.skipped.length) console.log(`       置かなかった家具: ${c.skipped.map((s) => `${s.room}:${FURNITURE[s.kind]?.label ?? s.kind}`).join("、")}`);
    // 2. 床面積の一致
    const area = round(floorAreaOf(p.building, c.floor.rooms), 2).toFixed(2);
    ok(c.title.includes(`${area}㎡`) && svg.includes(`${area}㎡`), `${c.level}階 床面積 ${area}㎡ がシートに入っている`);
    // 3. 帖数の一致（部屋名の下に出す種類だけ）
    for (const g of roomGroups(c.floor.rooms)) {
      const r = g[0];
      if (!["ldk", "living", "bedroom", "japanese", "study", "kitchen"].includes(r.type)) continue;
      const tatami = round(g.reduce((s, q) => s + q.w * q.d, 0) / TATAMI_M2, 1).toFixed(1) + "帖";
      // 部屋が小さいとき（h ≤ 40px）は帖数を描かないので、その場合は検査しない
      const h = Math.max(...g.map((q) => q.d)) * c.px;
      if (h <= 40) continue;
      ok(svg.includes(tatami), `${c.level}階 ${r.name} ${tatami}`);
    }
  }
  // 4. 注記
  for (const n of PLAN_NOTES) ok(svg.includes(n.slice(0, 12)), `注記「${n.slice(0, 12)}…」`);
  // 5. 書き出し
  const base = path.join(out, p.name.replace(/[\\/:*?"<>|\s]/g, "_"));
  fs.writeFileSync(base + ".svg", svg);
  if (chrome) {
    try {
      const html = `<!doctype html><html><body style="margin:0">${svg.replace(/^<\?xml[^>]*>\n?/, "")}</body></html>`;
      fs.writeFileSync(base + ".html", html);
      execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--screenshot=${base}.png`, "--window-size=1123,794", "file://" + base + ".html"], { stdio: "ignore", timeout: 60000 });
      // 成果物は JPEG にそろえる（ImageMagick があれば変換して PNG は消す。無ければ PNG のまま）
      try {
        execFileSync("convert", [base + ".png", "-background", "white", "-flatten", "-quality", "92", base + ".jpg"], { stdio: "ignore", timeout: 60000 });
        fs.unlinkSync(base + ".png");
        console.log(`  → ${base}.jpg`);
      } catch {
        console.log(`  → ${base}.png（ImageMagick が無いので JPEG 変換は省略）`);
      }
    } catch (e) {
      console.log(`  (PNG 化は失敗: ${(e as Error).message.slice(0, 80)})`);
    }
  } else console.log(`  → ${base}.svg（Chromium が無いので PNG は省略）`);
}

console.log(failures ? `\nNG ${failures} 件` : "\nすべて合格");
process.exit(failures ? 1 : 0);
