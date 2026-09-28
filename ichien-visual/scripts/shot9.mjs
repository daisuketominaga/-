// 階数切替ボタンの確認: node scripts/shot9.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3133", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "サンプル" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "間取り図", exact: true }).first().click(); await page.waitForTimeout(800);
const tabsBefore = await page.locator("button", { hasText: /^[123]F$/ }).count();
await page.getByRole("button", { name: "2階建て", exact: true }).click(); await page.waitForTimeout(400);
const tabsAfter = await page.locator("button", { hasText: /^[123]F$/ }).count();
const msg = await page.locator("text=/にしました/").first().innerText().catch(() => "(no msg)");
await page.screenshot({ path: `${out}/floors.png` });
console.log(JSON.stringify({ tabsBefore, tabsAfter, msg }));
await browser.close();
