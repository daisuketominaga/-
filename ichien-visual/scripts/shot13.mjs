// 離れ600・左端を離れ線に揃える・間取り図の切り欠き表示: node scripts/shot13.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3139", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(600);
await page.getByRole("button", { name: /離れ線の内側で最大の範囲にする/ }).click(); await page.waitForTimeout(500);
const dist1 = await page.locator("text=/境界までの距離/").first().innerText();
await page.getByRole("button", { name: "← 左" }).click(); await page.waitForTimeout(400);
const dist2 = await page.locator("text=/境界までの距離/").first().innerText();
await page.screenshot({ path: `${out}/push_left.png` });
await page.getByRole("button", { name: "間取り図", exact: true }).first().click(); await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/floor_notch.png` });
console.log(JSON.stringify({ dist1, dist2 }));
await browser.close();
