// 教材4（厚木・両面道路・道路後退）の敷地図と建築可能範囲: node scripts/shot11.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3135", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "敷地図", exact: true }).first().click(); await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/lesson4_site.png` });
const header = await page.locator("text=/敷地図/").first().innerText();
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/lesson4_grid.png` });
await page.getByRole("button", { name: "役所調査", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/lesson4_check.png` });
console.log(JSON.stringify({ header }));
await browser.close();
