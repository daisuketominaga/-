// ドラッグ操作の確認: node scripts/shot6.mjs <base> <out>
import { chromium } from "playwright";
const [base = "http://localhost:3127", out = "/tmp/shots"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "サンプル" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "建築可能範囲", exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /最大の範囲にする/ }).click();
await page.waitForTimeout(600);
const before = await page.locator("text=/建築面積/").first().innerText();
// 1) 建物をドラッグで右へ 1 マス（44px ≒ 0.91m... 表示は viewBox 縮尺なので 60px 動かす）
const poly = page.locator("polygon[data-building='1']");
const box = await poly.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(400);
const afterMove = await page.locator("text=/境界までの距離/").first().innerText(); await page.screenshot({ path: `${out}/moved.png` });
// 2) マス編集: 枠の外側のマスをクリックして足す
await page.getByRole("button", { name: "マスを足す・消す" }).click();
await page.waitForTimeout(300);
const box2 = await poly.boundingBox();
await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height + 8);
await page.waitForTimeout(500);
const afterCell = await page.locator("text=/建築面積/").first().innerText();
await page.screenshot({ path: `${out}/drag.png` });
// 3) 単位を 910 にして最大範囲
await page.getByRole("button", { name: "動かす・伸ばす" }).click();
await page.locator("select").filter({ has: page.locator("option", { hasText: "910mm" }) }).first().selectOption("0.91");
await page.getByRole("button", { name: /最大の範囲にする/ }).click();
await page.waitForTimeout(600);
const unit910 = await page.locator("text=/建築面積/").first().innerText();
await page.screenshot({ path: `${out}/unit910.png` });
console.log(JSON.stringify({ before, afterMove, afterCell, unit910 }));
await browser.close();
