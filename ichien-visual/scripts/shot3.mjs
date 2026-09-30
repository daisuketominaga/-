// 北側斜線を超える建物で天空率の表示を確認: node scripts/shot3.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3123", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "サンプル" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "立面図", exact: true }).first().click();
await page.waitForTimeout(800);
// 階数を4に、屋根を陸屋根に、用途地域を一低層に
const floors = page.locator("span.label", { hasText: "階数" }).locator("..").locator("input");
await floors.fill("4");
await page.locator("select").filter({ has: page.locator("option", { hasText: "陸屋根" }) }).first().selectOption("flat");
await page.locator("select").filter({ has: page.locator("option", { hasText: "第一種低層住居専用地域" }) }).first().selectOption("1low");
await page.waitForTimeout(2500);
const aside = page.locator("aside").first();
await aside.screenshot({ path: `${out}/northsky.png` });
await browser.close();
console.log("done");
