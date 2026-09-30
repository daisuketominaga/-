// 囲った中を塗りつぶす: node scripts/shot15.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3142", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on("dialog", (d) => d.accept());
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "教材4" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click(); await page.waitForTimeout(600);
await page.locator("select").filter({ hasText: "910mm" }).first().selectOption({ label: "910mm（1マス）" });
await page.getByRole("button", { name: "マスを足す・消す" }).click(); await page.waitForTimeout(300);
await page.getByRole("button", { name: "全部消す" }).click(); await page.waitForTimeout(300);
const o = await page.locator("circle[stroke='#c0392b']").first().boundingBox();
const px = 0.91 * 44;
const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
// 外周だけ 5×4 の枠を塗る（i=1..5, j=0..3）
const ring = [];
for (let i = 1; i <= 5; i++) { ring.push([i, 0]); ring.push([i, 3]); }
for (let j = 1; j <= 2; j++) { ring.push([1, j]); ring.push([5, j]); }
for (const [i, j] of ring) { await page.mouse.click(cx + (i + 0.5) * px, cy - (j + 0.5) * px); await page.waitForTimeout(120); }
const before = await page.locator("text=/塗ったマス/").first().innerText();
await page.getByRole("button", { name: "囲った中を塗りつぶす" }).click(); await page.waitForTimeout(400);
const after = await page.locator("text=/塗ったマス/").first().innerText();
const dist = await page.locator("text=/境界までの距離/").first().innerText();
await page.screenshot({ path: `${out}/fill_mode.png` });
console.log(JSON.stringify({ before, after, dist }));
await browser.close();
