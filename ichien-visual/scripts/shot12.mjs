// マス選びモード（離れ線の内側だけ選べる）の確認: node scripts/shot12.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3138", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator("select").filter({ hasText: "910mm" }).first().selectOption({ label: "910mm（1マス）" });
await page.getByRole("button", { name: "マスを足す・消す" }).click(); await page.waitForTimeout(300);
await page.getByRole("button", { name: /離れ線の角から始める/ }).click(); await page.waitForTimeout(400);
const before = await page.locator("text=/建築面積/").first().innerText();
// 建物の右隣・上隣のマスをクリックして足す
const poly = page.locator("polygon[data-building='1']");
const b = await poly.boundingBox();
const px = 0.91 * 44;
await page.mouse.click(b.x + b.width / 2 + px, b.y + b.height / 2); await page.waitForTimeout(200);
await page.mouse.click(b.x + b.width / 2 + 2 * px, b.y + b.height / 2); await page.waitForTimeout(200);
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2 - px); await page.waitForTimeout(200);
// 離れ線の外（敷地の角付近）をクリック → 入らない
const site = page.locator("svg polygon").first();
const sb = await site.boundingBox();
await page.mouse.click(sb.x + 6, sb.y + sb.height - 6); await page.waitForTimeout(300);
const hint = await page.locator("text=/離れ線.*外/").first().innerText().catch(() => "(no hint)");
const after = await page.locator("text=/建築面積/").first().innerText();
await page.screenshot({ path: `${out}/cells_mode.png` });
console.log(JSON.stringify({ before, after, hint }));
await browser.close();
