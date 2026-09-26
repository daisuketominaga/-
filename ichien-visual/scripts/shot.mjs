// 画面の確認用スクリーンショット: node scripts/shot.mjs <baseUrl> <outDir>
import { chromium } from "playwright";
const [base = "http://localhost:3123", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材3" }).click();
await page.waitForTimeout(500);
for (const [label, name, h] of [["建築可能範囲", "grid", 1100], ["間取り図", "floor", 1100], ["立面図", "elevation", 2600]]) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.setViewportSize({ width: 1500, height: h });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
}
await browser.close();
console.log("done");
