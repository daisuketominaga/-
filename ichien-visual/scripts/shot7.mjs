// 浴室・洗面・ガレージ記号と参考プラン UI の確認: node scripts/shot7.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3130", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "サンプル" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "間取り図", exact: true }).first().click();
await page.waitForTimeout(1200);
// 浴室を選んで 1616 に、洗面を選んで 1650 に
await page.getByRole("button", { name: /^浴室/ }).first().click();
await page.waitForTimeout(300);
const bathSel = page.locator("select").filter({ has: page.locator("option", { hasText: "1616" }) }).first();
await bathSel.selectOption("1616");
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^洗面・脱衣室/ }).first().click();
await page.waitForTimeout(300);
const vanSel = page.locator("select").filter({ has: page.locator("option", { hasText: "洗面台 1650mm" }) }).first();
await vanSel.selectOption("1650");
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/plan_symbols.png` });
await browser.close();
console.log("done");
