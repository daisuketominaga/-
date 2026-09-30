// タップ塗りの確認: node scripts/shot14.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3141", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator("select").filter({ hasText: "910mm" }).first().selectOption({ label: "910mm（1マス）" });
await page.getByRole("button", { name: "マスを足す・消す" }).click(); await page.waitForTimeout(300);
await page.getByRole("button", { name: "全部消す" }).click(); await page.waitForTimeout(300);
// 原点の印の位置から右上へ 1 マスずつタップ
const o = await page.locator("circle[stroke='#c0392b']").first().boundingBox();
const px = 0.91 * 44;
const taps = [[0.5, -0.5], [1.5, -0.5], [2.5, -0.5], [0.5, -1.5], [1.5, -1.5], [2.5, -1.5], [3.5, -1.5]];
for (const [dx, dy] of taps) { await page.mouse.click(o.x + o.width / 2 + dx * px, o.y + o.height / 2 + dy * px); await page.waitForTimeout(150); }
const count = await page.locator("text=/塗ったマス/").first().innerText();
await page.screenshot({ path: `${out}/paint_mode.png` });
console.log(JSON.stringify({ count }));
await browser.close();
