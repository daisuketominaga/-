// 階段状の最大範囲の確認: node scripts/shot5.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3126", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "サンプル" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /最大の範囲にする/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/stair_grid.png` });
await page.getByRole("button", { name: "間取り図", exact: true }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/stair_floor.png` });
await browser.close();
console.log("done");
