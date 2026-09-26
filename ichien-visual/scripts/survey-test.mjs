// 擬似測量図（scripts/survey-sample.html）を PNG にして、ローカルの /api/survey に投げて読み取り結果を表示する。
// 使い方: ANTHROPIC_API_KEY を .env.local に入れて `npm run dev` を起動した状態で
//   node scripts/survey-test.mjs            （PORT=3000 が既定）
import { chromium } from "playwright";
import fs from "node:fs";
const out = process.env.OUT || ".";
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await b.newPage({ viewport: { width: 1420, height: 1010 }, deviceScaleFactor: 1.5 });
await page.goto("file://" + process.cwd() + "/scripts/survey-sample.html");
await page.waitForTimeout(500);
const png = `${out}/survey_sample.png`;
await page.screenshot({ path: png });
await b.close();
console.log("wrote", png);
if (process.env.SKIP_API) process.exit(0);
const dataUrl = "data:image/png;base64," + fs.readFileSync(png).toString("base64");
const port = process.env.PORT || "3000";
const t0 = Date.now();
const res = await fetch(`http://localhost:${port}/api/survey`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl, hint: "" }) });
const json = await res.json();
console.log("status", res.status, `${Date.now() - t0}ms`);
console.log(JSON.stringify(json, null, 1).slice(0, 3000));
// 期待値: 辺長 8.40 / 9.19 / 8.14 / 1.35 / 7.63 / 0.42、面積 79.43、西側に幅員4.0mの道路
